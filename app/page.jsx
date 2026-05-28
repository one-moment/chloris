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

export default function Home() {
  const [state, setState] = useState(createInitialState);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("ideas");
  const [activeFilter, setActiveFilter] = useState("all");
  const [postDraft, setPostDraft] = useState({ title: "", body: "", status: "검토중" });
  const [messageDraft, setMessageDraft] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [fileDraft, setFileDraft] = useState({ name: "", source: "수동 추가" });
  const [projectDraft, setProjectDraft] = useState("");
  const [channelDraft, setChannelDraft] = useState({ name: "", type: "general" });
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showChannelDialog, setShowChannelDialog] = useState(false);

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

  async function refreshState() {
    const serverState = await requestJson("/api/state");
    if (serverState?.projects?.[0]?.channels) {
      setState(serverState);
      setStateLoaded(true);
    }
    return serverState;
  }

  async function mutateAndRefresh(url, body, method = "POST") {
    const result = await requestJson(url, {
      method,
      body: JSON.stringify(body)
    });
    await refreshState();
    return result;
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
    fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    }).catch(() => {});
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
  }

  function selectChannel(channelId) {
    setState((current) => ({ ...current, selectedChannelId: channelId }));
    setActiveTab("ideas");
  }

  async function createProject(event) {
    event.preventDefault();
    const name = projectDraft.trim();
    if (!name) return;
    try {
      await mutateAndRefresh("/api/projects", { name });
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
      await mutateAndRefresh(`/api/projects/${state.selectedProjectId}/channels`, {
        name,
        type: channelDraft.type
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
    if (!body) return;
    try {
      await mutateAndRefresh(`/api/channels/${channel.id}/messages`, { body, author: "captain" });
      setMessageDraft("");
    } catch (error) {
      console.error(error);
    }
  }

  async function createPost() {
    if (!postDraft.title.trim() || !postDraft.body.trim()) return;
    try {
      await mutateAndRefresh(`/api/channels/${channel.id}/posts`, {
        ...postDraft,
        author: "captain"
      });
      setPostDraft({ title: "", body: "", status: "검토중" });
    } catch (error) {
      console.error(error);
    }
  }

  async function changePostStatus(postId, status) {
    try {
      await mutateAndRefresh(`/api/posts/${postId}`, { status }, "PATCH");
    } catch (error) {
      console.error(error);
    }
  }

  async function addComment(postId) {
    const body = commentDrafts[postId]?.trim();
    if (!body) return;
    try {
      await mutateAndRefresh(`/api/posts/${postId}/comments`, { body, author: "captain" });
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    } catch (error) {
      console.error(error);
    }
  }

  async function addFile() {
    const name = fileDraft.name.trim();
    if (!name) return;
    try {
      await mutateAndRefresh(`/api/channels/${channel.id}/files`, {
        name,
        source: fileDraft.source || "수동 추가"
      });
      setFileDraft({ name: "", source: "수동 추가" });
    } catch (error) {
      console.error(error);
    }
  }

  async function runBot(bot) {
    try {
      await mutateAndRefresh(`/api/channels/${channel.id}/bot-runs`, {
        botId: bot.id,
        requester: "@captain"
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function completeRun(runId) {
    try {
      await mutateAndRefresh(`/api/bot-runs/${runId}`, { action: "complete" }, "PATCH");
    } catch (error) {
      console.error(error);
    }
  }

  async function approveRun(runId) {
    try {
      await mutateAndRefresh(`/api/bot-runs/${runId}`, { action: "approve" }, "PATCH");
    } catch (error) {
      console.error(error);
    }
  }

  async function rejectRun(runId) {
    try {
      await mutateAndRefresh(`/api/bot-runs/${runId}`, { action: "reject" }, "PATCH");
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
      />

      <section className="main-area">
        <Topbar project={project} channel={channel} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="work-surface">
          {activeTab === "messages" && (
            <MessagesView channel={channel} draft={messageDraft} onDraftChange={setMessageDraft} onSend={sendMessage} />
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
