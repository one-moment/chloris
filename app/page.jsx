"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthScreen from "../components/AuthScreen";
import AutomationPanel from "../components/AutomationPanel";
import FilesView from "../components/FilesView";
import IdeasView from "../components/IdeasView";
import MessagesView from "../components/MessagesView";
import ProjectSidebar from "../components/ProjectSidebar";
import Topbar from "../components/Topbar";
import { getPostStatuses } from "../lib/constants";
import { createInitialState } from "../lib/initialData";
import { getMentionedUserIds } from "../lib/mentions";

const MAX_INLINE_ATTACHMENT_SIZE = 1_500_000;

function makeClientId(prefix) {
  return `${prefix}-client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isTransientFetchError(error) {
  return error instanceof TypeError && error.message === "Failed to fetch";
}

export default function Home() {
  const [state, setState] = useState(createInitialState);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("messages");
  const [activeFilter, setActiveFilter] = useState("all");
  const [postAttachments, setPostAttachments] = useState([]);
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

  function replacePostInState(postId, nextPost) {
    updateChannel(channel.id, (channelItem) => ({
      ...channelItem,
      posts: channelItem.posts.map((post) => post.id === postId ? nextPost : post)
    }));
  }

  function replaceCommentInState(postId, nextComment) {
    updateChannel(channel.id, (channelItem) => ({
      ...channelItem,
      posts: channelItem.posts.map((post) => (
        post.id === postId
          ? { ...post, comments: (post.comments ?? []).map((comment) => comment.id === nextComment.id ? nextComment : comment) }
          : post
      ))
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
    let isRefreshing = false;

    const intervalId = window.setInterval(async () => {
      if (isRefreshing || document.hidden) return;
      isRefreshing = true;
      try {
        const serverState = await requestJson("/api/state");
        if (!serverState?.projects?.[0]?.channels) return;
        setState((current) => withSelection(serverState, current.selectedProjectId, current.selectedChannelId));
        setUsers(serverState.users ?? []);
      } catch (error) {
        if (!isTransientFetchError(error)) console.error(error);
      } finally {
        isRefreshing = false;
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

  const postStatuses = useMemo(() => getPostStatuses(channel), [channel]);
  const donePostStatus = postStatuses[postStatuses.length - 1];

  const filteredPosts = useMemo(() => {
    if (activeFilter === "mentions") {
      const mentionTokens = [currentUser?.name, currentUser?.handle].filter(Boolean).map((value) => `@${value}`);
      if (mentionTokens.length === 0 && !currentUser?.id) return [];
      const matchesMention = (text) => mentionTokens.some((token) => String(text ?? "").includes(token));
      return channel.posts.filter(
        (post) => matchesMention(post.title) || matchesMention(post.body) || (post.comments ?? []).some((comment) => (
          matchesMention(comment.body) || (comment.mentions ?? []).includes(currentUser?.id)
        ))
      );
    }
    if (activeFilter === "open") return channel.posts.filter((post) => post.status !== donePostStatus);
    return channel.posts;
  }, [activeFilter, channel.posts, currentUser?.handle, currentUser?.id, currentUser?.name, donePostStatus]);

  const counts = useMemo(
    () => ({
      review: channel.posts.filter((post) => post.status === postStatuses[0]).length,
      progress: channel.posts.filter((post) => post.status === postStatuses[1]).length,
      done: channel.posts.filter((post) => post.status === postStatuses[2]).length
    }),
    [channel.posts, postStatuses]
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

  async function deleteChannel(channelId) {
    const targetChannel = project.channels.find((item) => item.id === channelId);
    if (!targetChannel || project.channels.length <= 1) return;
    const confirmed = window.confirm(`${targetChannel.name} 채널을 삭제할까요? 메시지, 게시글, 파일 목록도 함께 삭제됩니다.`);
    if (!confirmed) return;

    const previousState = state;
    const remainingChannels = project.channels.filter((item) => item.id !== channelId);
    const selectedChannelId = channelId === state.selectedChannelId
      ? remainingChannels[0]?.id
      : state.selectedChannelId;

    setActionError("");
    setState((current) => ({
      ...current,
      selectedChannelId,
      projects: current.projects.map((projectItem) => (
        projectItem.id === project.id ? { ...projectItem, channels: remainingChannels } : projectItem
      ))
    }));
    setActiveFilter("all");

    try {
      const result = await requestJson(`/api/channels/${channelId}`, { method: "DELETE" });
      refreshStateInBackground({
        projectId: result.projectId ?? project.id,
        channelId: result.selectedChannelId ?? selectedChannelId
      });
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      setState(previousState);
    }
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

  async function sendMessage(draftBody) {
    const body = draftBody.trim();
    if (!body && messageAttachments.length === 0) return;
    const channelId = channel.id;
    const attachments = messageAttachments;
    setActionError("");
    setMessageAttachments([]);
    try {
      const created = await requestJson(`/api/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body,
          attachments
        })
      });
      updateChannel(channelId, (channelItem) => ({
        ...channelItem,
        messages: [created, ...channelItem.messages]
      }));
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId });
      return { ok: true };
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      setMessageAttachments(attachments);
      return { ok: false };
    }
  }

  async function createPost(draft) {
    const title = draft.title.trim()
      || draft.body.trim().slice(0, 40)
      || postAttachments[0]?.name
      || "";
    const body = draft.body.trim();
    if (!title && !body && postAttachments.length === 0) return;
    const channelId = channel.id;
    const attachments = postAttachments;
    setActionError("");
    setPostAttachments([]);
    setActiveFilter("all");
    try {
      const created = await requestJson(`/api/channels/${channelId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          status: draft.status,
          attachments
        })
      });
      updateChannel(channelId, (channelItem) => ({
        ...channelItem,
        posts: [created, ...channelItem.posts]
      }));
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId });
      return { ok: true };
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      setPostAttachments(attachments);
      return { ok: false };
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

  async function togglePostPin(postId, pinned) {
    try {
      const updated = await requestJson(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ pinned })
      });
      replacePostInState(postId, updated);
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId: channel.id });
    } catch (error) {
      console.error(error);
      setActionError(error.message);
    }
  }

  async function editMessage(messageId, body) {
    try {
      const updated = await requestJson(`/api/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ body })
      });
      updateChannel(channel.id, (channelItem) => ({
        ...channelItem,
        messages: channelItem.messages.map((message) => message.id === messageId ? updated : message)
      }));
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId: channel.id });
      return { ok: true };
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      return { ok: false };
    }
  }

  async function editPost(postId, patch) {
    try {
      const updated = await requestJson(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      replacePostInState(postId, updated);
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId: channel.id });
      return { ok: true };
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      return { ok: false };
    }
  }

  async function editComment(postId, commentId, body) {
    try {
      const updated = await requestJson(`/api/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          body,
          mentions: getMentionedUserIds(body, users)
        })
      });
      replaceCommentInState(postId, updated);
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId: channel.id });
      return { ok: true };
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      return { ok: false };
    }
  }

  async function addComment(postId) {
    const body = commentDrafts[postId]?.trim();
    if (!body) return;
    try {
      await mutateAndRefresh(`/api/posts/${postId}/comments`, { body, mentions: getMentionedUserIds(body, users) }, "POST", {
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

  async function actOnPurchaseRequest(requestId, action) {
    setActionError("");
    try {
      const endpoint = action === "run"
        ? `/api/purchase-bot/requests/${requestId}/run`
        : `/api/purchase-bot/requests/${requestId}/${action}`;
      await requestJson(endpoint, {
        method: "POST"
      });
      await refreshState({ projectId: state.selectedProjectId, channelId: channel.id });
      if (action === "run") {
        setTimeout(() => refreshStateInBackground({ projectId: state.selectedProjectId, channelId: channel.id }), 1800);
        setTimeout(() => refreshStateInBackground({ projectId: state.selectedProjectId, channelId: channel.id }), 6000);
      }
      return { ok: true };
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId: channel.id });
      return { ok: false };
    }
  }

  async function updatePurchaseOrderDraft(draftId, payload) {
    setActionError("");
    try {
      await requestJson(`/api/purchase-order-drafts/${draftId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      await refreshState({ projectId: state.selectedProjectId, channelId: channel.id });
      return { ok: true };
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId: channel.id });
      return { ok: false };
    }
  }

  async function approvePurchaseOrderDraft(draftId) {
    setActionError("");
    try {
      await requestJson(`/api/purchase-order-drafts/${draftId}/approve`, {
        method: "POST"
      });
      await refreshState({ projectId: state.selectedProjectId, channelId: channel.id });
      return { ok: true };
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId: channel.id });
      return { ok: false };
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
        onDeleteChannel={deleteChannel}
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
              currentUser={currentUser}
              users={users}
              attachments={messageAttachments}
              error={actionError}
              onAttachmentsChange={addMessageAttachments}
              onRemoveAttachment={(index) => removeAttachment(setMessageAttachments, index)}
              onSend={sendMessage}
              onEditMessage={editMessage}
              purchaseRequests={state.purchaseRequests ?? []}
              onPurchaseRequestAction={actOnPurchaseRequest}
              purchaseOrderDrafts={state.purchaseOrderDrafts ?? []}
              onPurchaseOrderDraftUpdate={updatePurchaseOrderDraft}
              onPurchaseOrderDraftApprove={approvePurchaseOrderDraft}
            />
          )}
          {activeTab === "ideas" && (
            <IdeasView
              channel={channel}
              posts={filteredPosts}
              currentUser={currentUser}
              users={users}
              counts={counts}
              activeFilter={activeFilter}
              postStatuses={postStatuses}
              onFilterChange={setActiveFilter}
              attachments={postAttachments}
              error={actionError}
              onAttachmentsChange={addPostAttachments}
              onRemoveAttachment={(index) => removeAttachment(setPostAttachments, index)}
              onCreatePost={createPost}
              commentDrafts={commentDrafts}
              onCommentDraftChange={(postId, value) => setCommentDrafts((current) => ({ ...current, [postId]: value }))}
              onAddComment={addComment}
              onStatusChange={changePostStatus}
              onEditPost={editPost}
              onEditComment={editComment}
              onTogglePin={togglePostPin}
            />
          )}
          {activeTab === "files" && (
            <FilesView channel={channel} draft={fileDraft} onDraftChange={setFileDraft} onAddFile={addFile} />
          )}
          <AutomationPanel
            channel={channel}
            bots={availableBots}
            currentUser={currentUser}
            users={users}
            requestJson={requestJson}
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
              <option value="improvement">개선 건의</option>
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
