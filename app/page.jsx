"use client";

import { useEffect, useMemo, useState } from "react";
import AutomationPanel from "../components/AutomationPanel";
import FilesView from "../components/FilesView";
import IdeasView from "../components/IdeasView";
import MessagesView from "../components/MessagesView";
import ProjectSidebar from "../components/ProjectSidebar";
import Topbar from "../components/Topbar";
import { CURRENT_USER, STORAGE_KEY } from "../lib/constants";
import { createInitialState } from "../lib/initialData";

const MAX_ATTACHMENT_SIZE = 1_500_000;

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

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error ?? "API request failed");
    return data;
  }

  function withSelection(serverState, preferredProjectId, preferredChannelId) {
    const selectedProject = serverState.projects.find((item) => item.id === preferredProjectId) ?? serverState.projects[0];
    const selectedChannel = selectedProject?.channels.find((item) => item.id === preferredChannelId) ?? selectedProject?.channels[0];
    return {
      ...serverState,
      selectedProjectId: selectedProject?.id,
      selectedChannelId: selectedChannel?.id
    };
  }

  async function refreshState(preferredSelection = {}) {
    const serverState = await requestJson("/api/state");
    if (serverState?.projects?.[0]?.channels) {
      const nextState = withSelection(
        serverState,
        preferredSelection.projectId ?? state.selectedProjectId,
        preferredSelection.channelId ?? state.selectedChannelId
      );
      setState(nextState);
      setStateLoaded(true);
      return nextState;
    }
    return serverState;
  }

  async function mutateAndRefresh(url, body, method = "POST", preferredSelection) {
    const result = await requestJson(url, {
      method,
      body: JSON.stringify(body)
    });
    await refreshState(preferredSelection);
    return result;
  }

  async function filesToAttachments(fileList) {
    const files = Array.from(fileList ?? []);
    const validFiles = files.filter((file) => file.size <= MAX_ATTACHMENT_SIZE);
    if (validFiles.length !== files.length) {
      window.alert("1.5MB 이하 파일만 첨부할 수 있습니다.");
    }

    return Promise.all(validFiles.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
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

    async function loadState() {
      try {
        const serverState = await requestJson("/api/state");
        if (!cancelled && serverState?.projects?.[0]?.channels) {
          setState(serverState);
          setStateLoaded(true);
          return;
        }
      } catch {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (!saved) {
          setStateLoaded(true);
          return;
        }
        try {
          const parsed = JSON.parse(saved);
          if (!cancelled && parsed?.projects?.[0]?.channels) setState(parsed);
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }

      if (!cancelled) setStateLoaded(true);
    }

    loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!stateLoaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, stateLoaded]);

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
      return channel.posts.filter(
        (post) => post.body.includes(CURRENT_USER) || (post.comments ?? []).some((comment) => comment.body.includes(CURRENT_USER))
      );
    }
    if (activeFilter === "open") return channel.posts.filter((post) => post.status !== "완료");
    return channel.posts;
  }, [activeFilter, channel.posts]);

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

  async function createProject(event) {
    event.preventDefault();
    const name = projectDraft.trim();
    if (!name) return;
    try {
      const created = await mutateAndRefresh("/api/projects", { name }, "POST", {
        projectId: null,
        channelId: null
      });
      await refreshState({
        projectId: created.id,
        channelId: created.channels?.[0]?.id
      });
      setProjectDraft("");
      setShowProjectDialog(false);
      setActiveTab("ideas");
    } catch (error) {
      console.error(error);
    }
  }

  async function createChannel(event) {
    event.preventDefault();
    const name = channelDraft.name.trim();
    if (!name) return;
    try {
      const created = await mutateAndRefresh(`/api/projects/${state.selectedProjectId}/channels`, {
        name,
        type: channelDraft.type
      }, "POST", {
        projectId: state.selectedProjectId
      });
      await refreshState({
        projectId: state.selectedProjectId,
        channelId: created.id
      });
      setChannelDraft({ name: "", type: "general" });
      setShowChannelDialog(false);
      setActiveTab("ideas");
    } catch (error) {
      console.error(error);
    }
  }

  async function sendMessage() {
    const body = messageDraft.trim();
    if (!body && messageAttachments.length === 0) return;
    try {
      await mutateAndRefresh(`/api/channels/${channel.id}/messages`, {
        body,
        author: "captain",
        attachments: messageAttachments
      }, "POST", {
        projectId: state.selectedProjectId,
        channelId: channel.id
      });
      setMessageDraft("");
      setMessageAttachments([]);
    } catch (error) {
      console.error(error);
    }
  }

  async function createPost() {
    const title = postDraft.title.trim()
      || postDraft.body.trim().slice(0, 40)
      || postAttachments[0]?.name
      || "";
    const body = postDraft.body.trim();
    if (!title && !body && postAttachments.length === 0) return;
    try {
      await mutateAndRefresh(
        `/api/channels/${channel.id}/posts`,
        {
          title,
          body,
          status: postDraft.status,
          author: "captain",
          attachments: postAttachments
        },
        "POST",
        {
          projectId: state.selectedProjectId,
          channelId: channel.id
        }
      );
      setPostDraft({ title: "", body: "", status: "검토중" });
      setPostAttachments([]);
      setActiveFilter("all");
    } catch (error) {
      console.error(error);
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
      await mutateAndRefresh(`/api/posts/${postId}/comments`, { body, author: "captain" }, "POST", {
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
          botId: bot.id,
          requester: "@captain"
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
    <main className="app-shell">
      <ProjectSidebar
        projects={state.projects}
        selectedProjectId={state.selectedProjectId}
        selectedChannelId={state.selectedChannelId}
        onSelectProject={selectProject}
        onSelectChannel={selectChannel}
        onNewProject={() => setShowProjectDialog(true)}
        onNewChannel={() => setShowChannelDialog(true)}
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
              counts={counts}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              draft={postDraft}
              onDraftChange={setPostDraft}
              attachments={postAttachments}
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
  );
}
