"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthScreen from "../AuthScreen";
import ProjectSidebar from "../ProjectSidebar";
import SearchDialog from "../SearchDialog";
import TemplateManagerDialog from "../TemplateManagerDialog";
import Icon from "../Icon";
import { getPostStatuses } from "../../lib/constants";
import { requestJson as apiRequestJson } from "../../lib/core/apiClient";
import { filesToAttachments } from "../../lib/core/attachments";
import { createInitialState } from "../../lib/initialData";
import { getMentionedUserIds } from "../../lib/mentions";
import { ACTIVE_BRAND } from "../../lib/brand";

const WorkspaceContext = createContext(null);

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceShell.");
  return context;
}

function makeClientId(prefix) {
  return `${prefix}-client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isTransientFetchError(error) {
  return error instanceof TypeError && error.message === "Failed to fetch";
}

export default function WorkspaceShell({ children }) {
  const router = useRouter();
  const [state, setState] = useState(createInitialState);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("messages");
  const [activeFilter, setActiveFilter] = useState("all");
  const [postAttachments, setPostAttachments] = useState([]);
  const [messageAttachments, setMessageAttachments] = useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [fileDraft, setFileDraft] = useState({ name: "", source: "수동 추가" });
  const [projectDraft, setProjectDraft] = useState("");
  const [channelDraft, setChannelDraft] = useState({ name: "", type: "general", branchId: "" });
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const requestJson = useCallback((url, options = {}) => apiRequestJson(url, options), []);

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

  const channelInsights = useMemo(() => {
    const meta = {};
    const notifications = [];
    if (!currentUser) return { meta, notifications };
    const myTokens = [currentUser.name, currentUser.handle].filter(Boolean).map((value) => `@${value}`);
    const matchesMe = (text) => myTokens.some((token) => String(text ?? "").includes(token));
    const readStates = state.readStates ?? {};

    for (const projectItem of state.projects) {
      for (const channelItem of projectItem.channels) {
        const lastRead = Date.parse(readStates[channelItem.id] ?? "") || 0;
        const isNew = (record) => (Date.parse(record.createdAtIso ?? "") || 0) > lastRead;
        let unread = 0;
        let hasMention = false;
        const base = {
          channelId: channelItem.id,
          channelName: channelItem.name,
          projectId: projectItem.id
        };

        for (const message of channelItem.messages ?? []) {
          if (!isNew(message) || message.authorId === currentUser.id) continue;
          unread += 1;
          if (matchesMe(message.body)) {
            hasMention = true;
            notifications.push({
              ...base,
              key: `message-${message.id}`,
              type: "mention",
              tab: "messages",
              author: message.author,
              snippet: message.body.slice(0, 80),
              createdAtIso: message.createdAtIso
            });
          }
        }

        for (const post of channelItem.posts ?? []) {
          if (isNew(post) && post.authorId !== currentUser.id) {
            unread += 1;
            if (matchesMe(post.title) || matchesMe(post.body)) {
              hasMention = true;
              notifications.push({
                ...base,
                key: `post-${post.id}`,
                type: "mention",
                tab: "ideas",
                author: post.author,
                snippet: post.title || post.body.slice(0, 80),
                createdAtIso: post.createdAtIso
              });
            } else if (post.pinned) {
              notifications.push({
                ...base,
                key: `notice-${post.id}`,
                type: "notice",
                tab: "ideas",
                author: post.author,
                snippet: post.title || post.body.slice(0, 80),
                createdAtIso: post.createdAtIso
              });
            }
          }

          for (const comment of post.comments ?? []) {
            if (!isNew(comment) || comment.authorId === currentUser.id) continue;
            const isMentioned = (comment.mentions ?? []).includes(currentUser.id) || matchesMe(comment.body);
            const isMyPost = post.authorId === currentUser.id;
            if (!isMentioned && !isMyPost) continue;
            if (isMentioned) hasMention = true;
            notifications.push({
              ...base,
              key: `comment-${comment.id}`,
              type: isMentioned ? "mention" : "comment",
              tab: "ideas",
              author: comment.author,
              snippet: comment.body.slice(0, 80),
              createdAtIso: comment.createdAtIso
            });
          }
        }

        meta[channelItem.id] = { unread, hasMention };
      }
    }

    notifications.sort((a, b) => new Date(b.createdAtIso ?? 0) - new Date(a.createdAtIso ?? 0));
    return { meta, notifications: notifications.slice(0, 20) };
  }, [state, currentUser]);

  const markingReadRef = useRef(false);

  useEffect(() => {
    if (!currentUser || !channel?.id || markingReadRef.current) return;
    const meta = channelInsights.meta[channel.id];
    const hasReadState = Boolean((state.readStates ?? {})[channel.id]);
    if (!meta || (meta.unread === 0 && hasReadState)) return;
    const channelId = channel.id;
    markingReadRef.current = true;
    requestJson(`/api/channels/${channelId}/read`, { method: "POST" })
      .then((result) => {
        if (result?.ok === false) return;
        setState((current) => ({
          ...current,
          readStates: { ...(current.readStates ?? {}), [channelId]: result?.lastReadAt ?? new Date().toISOString() }
        }));
      })
      .catch((error) => console.error(error))
      .finally(() => {
        markingReadRef.current = false;
      });
  }, [channel?.id, channelInsights, currentUser, requestJson, state.readStates]);

  const applyChannelFromUrl = useCallback((channelId) => {
    setState((current) => {
      const targetProject = current.projects.find((item) => item.channels.some((channelItem) => channelItem.id === channelId));
      if (!targetProject) return current;
      if (current.selectedProjectId === targetProject.id && current.selectedChannelId === channelId) return current;
      return {
        ...current,
        selectedProjectId: targetProject.id,
        selectedChannelId: channelId
      };
    });
  }, []);

  function navigateTo({ projectId, channelId, tab }) {
    setState((current) => {
      const targetProject = current.projects.find((item) => item.id === projectId)
        ?? current.projects.find((item) => item.channels.some((channelItem) => channelItem.id === channelId))
        ?? current.projects[0];
      const targetChannel = targetProject?.channels.find((item) => item.id === channelId) ?? targetProject?.channels[0];
      return {
        ...current,
        selectedProjectId: targetProject?.id,
        selectedChannelId: targetChannel?.id
      };
    });
    if (tab) setActiveTab(tab);
    setActiveFilter("all");
    if (channelId) router.push(`/chat/${channelId}`);
  }

  function selectProject(projectId) {
    const nextProject = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
    const nextChannelId = nextProject?.channels[0]?.id;
    setState((current) => ({
      ...current,
      selectedProjectId: nextProject?.id,
      selectedChannelId: nextChannelId
    }));
    setActiveTab("ideas");
    setActiveFilter("all");
    if (nextChannelId) router.push(`/chat/${nextChannelId}`);
  }

  function selectChannel(channelId) {
    setState((current) => ({ ...current, selectedChannelId: channelId }));
    setActiveTab("ideas");
    setActiveFilter("all");
    router.push(`/chat/${channelId}`);
  }

  async function deleteChannel(channelId) {
    const targetChannel = project.channels.find((item) => item.id === channelId);
    if (!targetChannel || project.channels.length <= 1) return;
    const confirmed = window.confirm(`${targetChannel.name} 채널을 삭제할까요? 메시지, 게시글, 파일 목록도 함께 삭제됩니다.`);
    if (!confirmed) return;

    const previousState = state;
    const remainingChannels = project.channels.filter((item) => item.id !== channelId);
    const wasSelected = channelId === state.selectedChannelId;
    const selectedChannelId = wasSelected ? remainingChannels[0]?.id : state.selectedChannelId;

    setActionError("");
    setState((current) => ({
      ...current,
      selectedChannelId,
      projects: current.projects.map((projectItem) => (
        projectItem.id === project.id ? { ...projectItem, channels: remainingChannels } : projectItem
      ))
    }));
    setActiveFilter("all");
    if (wasSelected && selectedChannelId) router.replace(`/chat/${selectedChannelId}`);

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
      if (created.channels?.[0]?.id) router.replace(`/chat/${created.channels[0].id}`);
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
    const branchId = channelDraft.branchId || null;
    const temporaryChannel = {
      id: makeClientId("channel"),
      name,
      type: channelDraft.type,
      branchId,
      messages: [],
      posts: [],
      files: [],
      botRuns: []
    };
    setActionError("");
    setChannelDraft({ name: "", type: "general", branchId: "" });
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
        body: JSON.stringify({ name, type: temporaryChannel.type, branchId })
      });
      replaceChannelId(temporaryChannel.id, created);
      router.replace(`/chat/${created.id}`);
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

  async function changeChannelBranch(channelId, branchId) {
    setActionError("");
    try {
      const updated = await requestJson(`/api/channels/${channelId}`, {
        method: "PATCH",
        body: JSON.stringify({ branchId: branchId || null })
      });
      updateChannel(channelId, (channelItem) => ({ ...channelItem, branchId: updated.branchId }));
      refreshStateInBackground({ projectId: state.selectedProjectId, channelId });
    } catch (error) {
      console.error(error);
      setActionError(error.message);
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

  async function addReply(postId, parentId, body) {
    try {
      await mutateAndRefresh(`/api/posts/${postId}/comments`, {
        body,
        parentId,
        mentions: getMentionedUserIds(body, users)
      }, "POST", {
        projectId: state.selectedProjectId,
        channelId: channel.id
      });
      return { ok: true };
    } catch (error) {
      console.error(error);
      setActionError(error.message);
      return { ok: false };
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

  const reloadTemplates = useCallback(async () => {
    try {
      const data = await requestJson("/api/post-templates");
      setTemplates(data?.templates ?? []);
    } catch (error) {
      console.error(error);
    }
  }, [requestJson]);

  useEffect(() => {
    if (!currentUser) {
      setTemplates([]);
      return;
    }
    reloadTemplates();
  }, [currentUser, reloadTemplates]);

  async function createTemplate(form) {
    try {
      await requestJson("/api/post-templates", { method: "POST", body: JSON.stringify(form) });
      await reloadTemplates();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function updateTemplate(templateId, form) {
    try {
      await requestJson(`/api/post-templates/${templateId}`, { method: "PATCH", body: JSON.stringify(form) });
      await reloadTemplates();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function deleteTemplate(templateId) {
    try {
      await requestJson(`/api/post-templates/${templateId}`, { method: "DELETE" });
      await reloadTemplates();
      return { ok: true };
    } catch (error) {
      console.error(error);
      return { ok: false, error: error.message };
    }
  }

  const workspaceValue = {
    state,
    stateLoaded,
    currentUser,
    users,
    project,
    channel,
    activeTab,
    setActiveTab,
    activeFilter,
    setActiveFilter,
    filteredPosts,
    counts,
    postStatuses,
    availableBots,
    channelInsights,
    actionError,
    requestJson,
    applyChannelFromUrl,
    navigateTo,
    openSearch: () => setShowSearchDialog(true),
    templates,
    openTemplateManager: () => setShowTemplateManager(true),
    createTemplate,
    updateTemplate,
    deleteTemplate,
    openSidebar: () => setIsSidebarOpen(true),
    messageAttachments,
    postAttachments,
    addMessageAttachments,
    addPostAttachments,
    removeMessageAttachment: (index) => removeAttachment(setMessageAttachments, index),
    removePostAttachment: (index) => removeAttachment(setPostAttachments, index),
    commentDrafts,
    setCommentDraft: (postId, value) => setCommentDrafts((current) => ({ ...current, [postId]: value })),
    fileDraft,
    setFileDraft,
    sendMessage,
    editMessage,
    createPost,
    changePostStatus,
    editPost,
    editComment,
    addComment,
    addReply,
    togglePostPin,
    addFile,
    runBot,
    completeRun,
    approveRun,
    rejectRun,
    actOnPurchaseRequest,
    updatePurchaseOrderDraft,
    approvePurchaseOrderDraft,
    changeChannelBranch
  };

  return (
    <WorkspaceContext.Provider value={workspaceValue}>
      {!authLoaded || !stateLoaded ? (
        <main className="loading-shell">불러오는 중...</main>
      ) : !currentUser ? (
        <AuthScreen
          onLogin={(form) => authenticate("/api/auth/login", form)}
          onRegister={(form) => authenticate("/api/auth/register", form)}
          error={authError}
          isSubmitting={isAuthSubmitting}
        />
      ) : (
        <div className="workspace-root" data-theme="forest" data-sidebar="dark" data-cards="comfortable" data-chips="soft">
        <main className="app-shell">
          <nav className="rail" aria-label="워크스페이스">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Link className="rail-logo" href="/" aria-label="홈"><img src={ACTIVE_BRAND.logo} alt="" /></Link>
            <button className="rail-button" type="button" onClick={() => setShowSearchDialog(true)} aria-label="검색">
              <Icon name="search" size={21} />
            </button>
            <div className="rail-spacer" />
            <div className="rail-avatar" aria-hidden="true">{(currentUser?.name ?? "?").trim().slice(0, 1).toUpperCase()}</div>
          </nav>
          <ProjectSidebar
            projects={state.projects}
            selectedProjectId={state.selectedProjectId}
            selectedChannelId={state.selectedChannelId}
            channelMeta={channelInsights.meta}
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
            {children}
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

          {showSearchDialog && (
            <SearchDialog
              requestJson={requestJson}
              onNavigate={navigateTo}
              onClose={() => setShowSearchDialog(false)}
            />
          )}

          {showTemplateManager && (
            <TemplateManagerDialog
              templates={templates}
              channels={state.projects.flatMap((projectItem) => projectItem.channels.map((channelItem) => ({ id: channelItem.id, name: channelItem.name })))}
              currentChannelId={channel?.id}
              currentUser={currentUser}
              onCreate={createTemplate}
              onUpdate={updateTemplate}
              onDelete={deleteTemplate}
              onClose={() => setShowTemplateManager(false)}
            />
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
                <select value={channelDraft.branchId} onChange={(event) => setChannelDraft({ ...channelDraft, branchId: event.target.value })} aria-label="지점 선택">
                  <option value="">지점 없음 (공통 채널)</option>
                  {(state.branches ?? []).map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowChannelDialog(false)}>취소</button>
                  <button className="primary-button" type="submit">생성</button>
                </div>
              </form>
            </div>
          )}
        </main>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
