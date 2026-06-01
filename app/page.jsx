"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthScreen from "../components/AuthScreen";
import AutomationPanel from "../components/AutomationPanel";
import FilesView from "../components/FilesView";
import IdeasView from "../components/IdeasView";
import MessagesView from "../components/MessagesView";
import ProjectSidebar from "../components/ProjectSidebar";
import Topbar from "../components/Topbar";
import { createInitialState } from "../lib/initialData";

const MAX_INLINE_ATTACHMENT_SIZE = 1_500_000;

function makeClientId(prefix) {
  return `${prefix}-client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [state, setState] = useState(createInitialState);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("ideas");
  const [activeFilter, setActiveFilter] = useState("all");
  const [postDraft, setPostDraft] = useState({ title: "", body: "", status: "검토중" });
  const [postAttachments, setPostAttachments] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageAttachments, setMessageAttachments] = useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [fileDraft, setFileDraft] = useState({ name: "", source: "수동 추가" });
  const [projectDraft, setProjectDraft] = useState("");
  const [channelDraft, setChannelDraft] = useState({ name: "", type: "general" });
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const requestJson = useCallback(async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      }
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      throw new Error(data?.error ?? `API request failed (${response.status})`);
    }
    return data;
  }, []);

  const withSelection = useCallback(function withSelection(serverState, preferredProjectId, preferredChannelId) {
    const selectedProject = serverState.projects.find((item) => item.id === preferredProjectId) ?? serverState.projects[0];
    const selectedChannel = selectedProject?.channels.find((item) => item.id === preferredChannelId) ?? selectedProject?.channels[0];
    return {
      ...serverState,
      selectedProjectId: selectedProject?.id,
      selectedChannelId: selectedChannel?.id
    };
  }, []);

  async function refreshState(preferredSelection = {}) {
    const serverState = await requestJson("/api/state");
    if (serverState?.projects?.[0]?.channels) {
      const nextState = withSelection(
        serverState,
        preferredSelection.projectId ?? state.selectedProjectId,
        preferredSelection.channelId ?? state.selectedChannelId
      );
      setState(nextState);
      setUsers(serverState.users ?? []);
      setStateLoaded(true);
      return nextState;
    }
    return serverState;
  }

  async function mutateAndRefresh(url, body, method = "POST", preferredSelection) {
    setActionError("");
    const result = await requestJson(url, {
      method,
      body: JSON.stringify(body)
    });
    await refreshState(preferredSelection);
    return result;
  }

  function refreshStateInBackground(preferredSelection = {}) {
    refreshState(preferredSelection).catch((error) => {
      console.error(error);
      setActionError(error.message);
    });
  }

  function updateChannel(channelId, mutator) {
    setState((current) => ({
      ...current,
      projects: current.projects.map((projectItem) => ({
        ...projectItem,
        channels: projectItem.channels.map((channelItem) => (
          channelItem.id === channelId ? mutator(channelItem) : channelItem
        ))
      }))
    }));
  }

  function replaceChannelId(previousId, nextChannel) {
    setState((current) => ({
      ...current,
      selectedChannelId: current.selectedChannelId === previousId ? nextChannel.id : current.selectedChannelId,
      projects: current.projects.map((projectItem) => ({
        ...projectItem,
        channels: projectItem.channels.map((channelItem) => (
          channelItem.id === previousId ? nextChannel : channelItem
        ))
      }))
    }));
  }

  async function filesToAttachments(fileList) {
    const files = Array.from(fileList ?? []);
    const uploaded = [];

    for (const file of files) {
      const target = await requestJson("/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size
        })
      });

      if (target.provider === "s3") {
        await fetch(target.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream"
          },
          body: file
        });
        uploaded.push({
          id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          storage: "s3",
          key: target.key,
          url: target.publicUrl
        });
        continue;
      }

      if (file.size > MAX_INLINE_ATTACHMENT_SIZE) {
        window.alert("로컬 inline 저장은 1.5MB 이하 파일만 첨부할 수 있습니다. 운영에서는 S3 설정을 사용하세요.");
        continue;
      }

      uploaded.push(await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          storage: "inline",
          dataUrl: reader.result
        });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }));
    }

    return uploaded;
  }

  async function addMessageAttachments(fileList) {
    const attachments = await filesToAttachments(fileList);
    setMessageAttachments((current) => [...current, ...attachments]);
  }

  async function addPostAttachments(fileList) {
    const attachments = await filesToAttachments(fileList);
    setPostAttachments((current) => [...current, ...attachments]);
  }

  function removeAttachment(setter, index) {
    setter((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const session = await requestJson("/api/auth/me");
        if (cancelled) return;
        setCurrentUser(session.currentUser);
        setUsers(session.users ?? []);
        setAuthLoaded(true);

        if (session.currentUser) {
          const serverState = await requestJson("/api/state");
          if (!cancelled && serverState?.projects?.[0]?.channels) {
            setState(serverState);
            setUsers(serverState.users ?? []);
            setStateLoaded(true);
          }
        } else {
          setStateLoaded(true);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setAuthLoaded(true);
          setStateLoaded(true);
        }
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [requestJson]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const intervalId = window.setInterval(async () => {
      try {
        const serverState = await requestJson("/api/state");
        if (!serverState?.projects?.[0]?.channels) return;
        setState((current) => withSelection(serverState, current.selectedProjectId, current.selectedChannelId));
        setUsers(serverState.users ?? []);
      } catch (error) {
        console.error(error);
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [currentUser, requestJson, withSelection]);

  const project = useMemo(
    () => state.projects.find((item) => item.id === state.selectedProjectId) ?? state.projects[0],
    [state]
  );

  const channel = useMemo(
    () => project.channels.find((item) => item.id === state.selectedChannelId) ?? project.channels[0],
    [project, state.selectedChannelId]
  );

  const availableBots = useMemo(
    () => state.bots.filter((bot) => bot.channelTypes.includes(channel.type)),
    [state.bots, channel.type]
  );

  const filteredPosts = useMemo(() => {
    if (activeFilter === "mentions") {
      const mention = currentUser?.handle;
      if (!mention) return [];
      return channel.posts.filter(
        (post) => post.title.includes(mention) || post.body.includes(mention) || (post.comments ?? []).some((comment) => comment.body.includes(mention))
      );
    }
    if (activeFilter === "open") return channel.posts.filter((post) => post.status !== "완료");
    return channel.posts;
  }, [activeFilter, channel.posts, currentUser?.handle]);

  const counts = useMemo(
    () => ({
      review: channel.posts.filter((post) => post.status === "검토중").length,
      progress: channel.posts.filter((post) => post.status === "진행중").length,
      done: channel.posts.filter((post) => post.status === "완료").length
    }),
    [channel.posts]
  );

  function selectProject(projectId) {
    setState((current) => {
      const nextProject = current.projects.find((item) => item.id === projectId) ?? current.projects[0];
      return {
        ...current,
        selectedProjectId: nextProject.id,
        selectedChannelId: nextProject.channels[0]?.id
      };
    });
    setActiveTab("ideas");
    setActiveFilter("all");
  }

  function selectChannel(channelId) {
    setState((current) => ({ ...current, selectedChannelId: channelId }));
    setActiveTab("ideas");
    setActiveFilter("all");
  }

  async function authenticate(url, body) {
    setAuthError("");
    setIsAuthSubmitting(true);
    try {
      const result = await requestJson(url, {
        method: "POST",
        body: JSON.stringify(body)
      });
      setCurrentUser(result.user);
      setAuthLoaded(true);
      try {
        const session = await requestJson("/api/auth/me");
        setUsers(session.users ?? []);
        await refreshState();
      } catch (sessionError) {
        console.error(sessionError);
        setStateLoaded(true);
        setAuthError("계정은 생성됐지만 화면 데이터를 불러오지 못했습니다. 새로고침 후 다시 확인해주세요.");
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function logout() {
    try {
      await requestJson("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error(error);
    }
    setCurrentUser(null);
    setUsers([]);
    setStateLoaded(true);
  }

  async function createProject(event) {
    event.preventDefault();
    const name = projectDraft.trim();
    if (!name) return;
    const temporaryProject = {
      id: makeClientId("project"),
      name,
      description: `${name} 내부 커뮤니케이션 공간`,
      channels: [
        {
          id: makeClientId("channel"),
          name: "매니저 소통",
          type: "general",
          messages: [],
          posts: [],
          files: [],
          botRuns: []
        }
      ]
    };
    setActionError("");
    setProjectDraft("");
    setShowProjectDialog(false);
    setActiveTab("ideas");
    setState((current) => ({
      ...current,
      selectedProjectId: temporaryProject.id,
      selectedChannelId: temporaryProject.channels[0]?.id,
      projects: [...current.projects, temporaryProject]
    }));
    try {
      const created = await requestJson("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      setState((current) => ({
        ...current,
        selectedProjectId: created.id,
        selectedChannelId: created.channels?.[0]?.id,
        projects: current.projects.map((projectItem) => (
          projectItem.id === temporaryProject.id ? created : projectItem
        ))
      }));
      refreshStateInBackground({ projectId: created.id, channelId: created.channels?.[0]?.id });
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      setState((current) => {
        const nextProjects = current.projects.filter((projectItem) => projectItem.id !== temporaryProject.id);
        const selectedProject = nextProjects[0];
        const selectedChannel = selectedProject?.channels[0];
        return {
          ...current,
          projects: nextProjects,
          selectedProjectId: selectedProject?.id,
          selectedChannelId: selectedChannel?.id
        };
      });
    }
  }

  async function createChannel(event) {
    event.preventDefault();
    const name = channelDraft.name.trim();
    if (!name) return;
    const temporaryChannel = {
      id: makeClientId("channel"),
      name,
      type: channelDraft.type,
      messages: [],
      posts: [],
      files: [],
      botRuns: []
    };
    setActionError("");
    setChannelDraft({ name: "", type: "general" });
    setShowChannelDialog(false);
    setActiveTab("ideas");
    setState((current) => ({
      ...current,
      selectedChannelId: temporaryChannel.id,
      projects: current.projects.map((projectItem) => (
        projectItem.id === current.selectedProjectId
          ? { ...projectItem, channels: [...projectItem.channels, temporaryChannel] }
          : projectItem
      ))
    }));
    try {
      const projectId = state.selectedProjectId;
      const created = await requestJson(`/api/projects/${projectId}/channels`, {
        method: "POST",
        body: JSON.stringify({ name, type: temporaryChannel.type })
      });
      replaceChannelId(temporaryChannel.id, created);
      refreshStateInBackground({ projectId, channelId: created.id });
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      setState((current) => {
        const selectedProject = current.projects.find((projectItem) => projectItem.id === current.selectedProjectId) ?? current.projects[0];
        const channels = selectedProject?.channels.filter((channelItem) => channelItem.id !== temporaryChannel.id) ?? [];
        return {
          ...current,
          selectedChannelId: channels[0]?.id,
          projects: current.projects.map((projectItem) => (
            projectItem.id === selectedProject?.id ? { ...projectItem, channels } : projectItem
          ))
        };
      });
    }
  }

  async function sendMessage() {
    const body = messageDraft.trim();
    if (!body && messageAttachments.length === 0) return;
    const channelId = channel.id;
    const optimisticMessage = {
      id: makeClientId("msg"),
      authorId: currentUser.id,
      author: currentUser.name,
      body,
      attachments: messageAttachments,
      createdAt: "방금 전",
      bot: false
    };
    setActionError("");
    setMessageDraft("");
    setMessageAttachments([]);
    updateChannel(channelId, (channelItem) => ({
      ...channelItem,
      messages: [optimisticMessage, ...channelItem.messages]
    }));
    try {
      const created = await requestJson(`/api/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body,
          attachments: optimisticMessage.attachments
        })
      });
      updateChannel(channelId, (channelItem) => ({
        ...channelItem,
        messages: channelItem.messages.map((message) => (
          message.id === optimisticMessage.id ? created : message
        ))
      }));
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId });
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      updateChannel(channelId, (channelItem) => ({
        ...channelItem,
        messages: channelItem.messages.filter((message) => message.id !== optimisticMessage.id)
      }));
      setMessageDraft(body);
      setMessageAttachments(optimisticMessage.attachments);
    }
  }

  async function createPost() {
    const title = postDraft.title.trim()
      || postDraft.body.trim().slice(0, 40)
      || postAttachments[0]?.name
      || "";
    const body = postDraft.body.trim();
    if (!title && !body && postAttachments.length === 0) return;
    const channelId = channel.id;
    const optimisticPost = {
      id: makeClientId("post"),
      title,
      body,
      attachments: postAttachments,
      authorId: currentUser.id,
      author: currentUser.name,
      status: postDraft.status,
      createdAt: "방금 전",
      comments: []
    };
    setActionError("");
    setPostDraft({ title: "", body: "", status: "검토중" });
    setPostAttachments([]);
    setActiveFilter("all");
    updateChannel(channelId, (channelItem) => ({
      ...channelItem,
      posts: [optimisticPost, ...channelItem.posts]
    }));
    try {
      const created = await requestJson(`/api/channels/${channelId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          status: optimisticPost.status,
          attachments: optimisticPost.attachments
        })
      });
      updateChannel(channelId, (channelItem) => ({
        ...channelItem,
        posts: channelItem.posts.map((post) => (
          post.id === optimisticPost.id ? created : post
        ))
      }));
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId });
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      updateChannel(channelId, (channelItem) => ({
        ...channelItem,
        posts: channelItem.posts.filter((post) => post.id !== optimisticPost.id)
      }));
      setPostDraft({ title: postDraft.title, body: postDraft.body, status: optimisticPost.status });
      setPostAttachments(optimisticPost.attachments);
    }
  }

  async function changePostStatus(postId, status) {
    try {
      await mutateAndRefresh(`/api/posts/${postId}`, { status }, "PATCH", {
        projectId: state.selectedProjectId,
        channelId: channel.id
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function addComment(postId) {
    const body = commentDrafts[postId]?.trim();
    if (!body) return;
    try {
      await mutateAndRefresh(`/api/posts/${postId}/comments`, { body }, "POST", {
        projectId: state.selectedProjectId,
        channelId: channel.id
      });
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    } catch (error) {
      console.error(error);
    }
  }

  async function addFile() {
    const name = fileDraft.name.trim();
    if (!name) return;
    try {
      await mutateAndRefresh(
        `/api/channels/${channel.id}/files`,
        {
          name,
          source: fileDraft.source || "수동 추가"
        },
        "POST",
        {
          projectId: state.selectedProjectId,
          channelId: channel.id
        }
      );
      setFileDraft({ name: "", source: "수동 추가" });
    } catch (error) {
      console.error(error);
    }
  }

  async function runBot(bot) {
    try {
      await mutateAndRefresh(
        `/api/channels/${channel.id}/bot-runs`,
        {
          botId: bot.id
        },
        "POST",
        {
          projectId: state.selectedProjectId,
          channelId: channel.id
        }
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function completeRun(runId) {
    try {
      await mutateAndRefresh(`/api/bot-runs/${runId}`, { action: "complete" }, "PATCH", {
        projectId: state.selectedProjectId,
        channelId: channel.id
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function approveRun(runId) {
    try {
      await mutateAndRefresh(`/api/bot-runs/${runId}`, { action: "approve" }, "PATCH", {
        projectId: state.selectedProjectId,
        channelId: channel.id
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function rejectRun(runId) {
    try {
      await mutateAndRefresh(`/api/bot-runs/${runId}`, { action: "reject" }, "PATCH", {
        projectId: state.selectedProjectId,
        channelId: channel.id
      });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    !authLoaded || !stateLoaded ? (
      <main className="loading-shell">불러오는 중...</main>
    ) : !currentUser ? (
      <AuthScreen
        onLogin={(form) => authenticate("/api/auth/login", form)}
        onRegister={(form) => authenticate("/api/auth/register", form)}
        error={authError}
        isSubmitting={isAuthSubmitting}
      />
    ) : (
    <main className="app-shell">
      <ProjectSidebar
        projects={state.projects}
        selectedProjectId={state.selectedProjectId}
        selectedChannelId={state.selectedChannelId}
        onSelectProject={selectProject}
        onSelectChannel={selectChannel}
        onNewProject={() => setShowProjectDialog(true)}
        onNewChannel={() => setShowChannelDialog(true)}
        currentUser={currentUser}
        onLogout={logout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      {isSidebarOpen && <button className="sidebar-backdrop" type="button" onClick={() => setIsSidebarOpen(false)} aria-label="채널 패널 닫기" />}

      <section className="main-area">
        <Topbar
          project={project}
          channel={channel}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        <div className="work-surface">
          {activeTab === "messages" && (
            <MessagesView
              channel={channel}
              draft={messageDraft}
              attachments={messageAttachments}
              error={actionError}
              onDraftChange={setMessageDraft}
              onAttachmentsChange={addMessageAttachments}
              onRemoveAttachment={(index) => removeAttachment(setMessageAttachments, index)}
              onSend={sendMessage}
            />
          )}
          {activeTab === "ideas" && (
            <IdeasView
              channel={channel}
              posts={filteredPosts}
              users={users}
              counts={counts}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              draft={postDraft}
              onDraftChange={setPostDraft}
              attachments={postAttachments}
              error={actionError}
              onAttachmentsChange={addPostAttachments}
              onRemoveAttachment={(index) => removeAttachment(setPostAttachments, index)}
              onCreatePost={createPost}
              commentDrafts={commentDrafts}
              onCommentDraftChange={(postId, value) => setCommentDrafts((current) => ({ ...current, [postId]: value }))}
              onAddComment={addComment}
              onStatusChange={changePostStatus}
            />
          )}
          {activeTab === "files" && (
            <FilesView channel={channel} draft={fileDraft} onDraftChange={setFileDraft} onAddFile={addFile} />
          )}
          <AutomationPanel
            channel={channel}
            bots={availableBots}
            onRunBot={runBot}
            onCompleteRun={completeRun}
            onApproveRun={approveRun}
            onRejectRun={rejectRun}
          />
        </div>
      </section>

      {showProjectDialog && (
        <div className="next-dialog-fallback">
          <form className="modal-card" onSubmit={createProject}>
            <h2>프로젝트 생성</h2>
            <input value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} placeholder="프로젝트 이름" autoFocus />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowProjectDialog(false)}>취소</button>
              <button className="primary-button" type="submit">생성</button>
            </div>
          </form>
        </div>
      )}

      {showChannelDialog && (
        <div className="next-dialog-fallback">
          <form className="modal-card" onSubmit={createChannel}>
            <h2>채널 생성</h2>
            <input value={channelDraft.name} onChange={(event) => setChannelDraft({ ...channelDraft, name: event.target.value })} placeholder="채널 이름" autoFocus />
            <select value={channelDraft.type} onChange={(event) => setChannelDraft({ ...channelDraft, type: event.target.value })}>
              <option value="general">일반 소통</option>
              <option value="purchase">구매요청</option>
              <option value="inbound">입고</option>
              <option value="outbound">출고</option>
              <option value="inventory">재고관리</option>
            </select>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowChannelDialog(false)}>취소</button>
              <button className="primary-button" type="submit">생성</button>
            </div>
          </form>
        </div>
      )}
    </main>
    )
  );
}
