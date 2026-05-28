"use client";

import { useEffect, useMemo, useState } from "react";
import AutomationPanel from "../components/AutomationPanel";
import FilesView from "../components/FilesView";
import IdeasView from "../components/IdeasView";
import MessagesView from "../components/MessagesView";
import ProjectSidebar from "../components/ProjectSidebar";
import Topbar from "../components/Topbar";
import { CURRENT_USER, STORAGE_KEY } from "../lib/constants";
import { buildAutomationPayload, completeBotRun, makeBotRun } from "../lib/automation";
import { createInitialState, makeChannel, makeMessage, makePost } from "../lib/initialData";

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

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const response = await fetch("/api/state");
        if (!response.ok) throw new Error("Failed to load server state");
        const serverState = await response.json();
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

  function updateCurrentChannel(mutator) {
    setState((current) => ({
      ...current,
      projects: current.projects.map((projectItem) => {
        if (projectItem.id !== current.selectedProjectId) return projectItem;
        return {
          ...projectItem,
          channels: projectItem.channels.map((channelItem) => {
            if (channelItem.id !== current.selectedChannelId) return channelItem;
            const nextChannel = structuredClone(channelItem);
            mutator(nextChannel, projectItem);
            return nextChannel;
          })
        };
      })
    }));
  }

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

  function createProject(event) {
    event.preventDefault();
    const name = projectDraft.trim();
    if (!name) return;
    const firstChannel = makeChannel("매니저 소통", "general");
    const projectId = `project-${Date.now()}`;
    setState((current) => ({
      ...current,
      selectedProjectId: projectId,
      selectedChannelId: firstChannel.id,
      projects: [
        ...current.projects,
        {
          id: projectId,
          name,
          description: `${name} 내부 커뮤니케이션 공간`,
          channels: [firstChannel]
        }
      ]
    }));
    setProjectDraft("");
    setShowProjectDialog(false);
  }

  function createChannel(event) {
    event.preventDefault();
    const name = channelDraft.name.trim();
    if (!name) return;
    const newChannel = makeChannel(name, channelDraft.type);
    setState((current) => ({
      ...current,
      selectedChannelId: newChannel.id,
      projects: current.projects.map((projectItem) => (
        projectItem.id === current.selectedProjectId
          ? { ...projectItem, channels: [...projectItem.channels, newChannel] }
          : projectItem
      ))
    }));
    setChannelDraft({ name: "", type: "general" });
    setShowChannelDialog(false);
    setActiveTab("ideas");
  }

  function sendMessage() {
    const body = messageDraft.trim();
    if (!body) return;
    updateCurrentChannel((next) => {
      next.messages.unshift(makeMessage(body, "captain"));
    });
    setMessageDraft("");
  }

  function createPost() {
    if (!postDraft.title.trim() || !postDraft.body.trim()) return;
    updateCurrentChannel((next) => {
      next.posts.unshift(makePost({ ...postDraft, author: "captain" }));
    });
    setPostDraft({ title: "", body: "", status: "검토중" });
  }

  function changePostStatus(postId, status) {
    updateCurrentChannel((next) => {
      next.posts = next.posts.map((post) => (post.id === postId ? { ...post, status } : post));
    });
  }

  function addComment(postId) {
    const body = commentDrafts[postId]?.trim();
    if (!body) return;
    updateCurrentChannel((next) => {
      next.posts = next.posts.map((post) => (
        post.id === postId
          ? {
              ...post,
              comments: [
                ...(post.comments ?? []),
                { id: `comment-${Date.now()}`, author: "captain", body, createdAt: "방금 전" }
              ]
            }
          : post
      ));
    });
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
  }

  function addFile() {
    const name = fileDraft.name.trim();
    if (!name) return;
    updateCurrentChannel((next) => {
      next.files.unshift({
        id: `file-${Date.now()}`,
        name,
        source: fileDraft.source || "수동 추가",
        createdAt: "방금 전"
      });
    });
    setFileDraft({ name: "", source: "수동 추가" });
  }

  function runBot(bot) {
    const payload = buildAutomationPayload({ project, channel, bot });
    const run = makeBotRun({ bot, channel, payload });
    updateCurrentChannel((next) => {
      next.botRuns.unshift(run);
      next.messages.unshift(makeMessage(`${bot.name} 실행 요청을 보냈습니다.`, "자동화 허브", true));
    });
  }

  function completeRun(runId) {
    updateCurrentChannel((next) => {
      next.botRuns = next.botRuns.map((run) => (run.id === runId ? completeBotRun(run, next.type) : run));
      const completed = next.botRuns.find((run) => run.id === runId);
      if (next.type === "purchase") {
        next.files.unshift({ id: `file-${Date.now()}`, name: "purchase-review-draft.json", source: "Codex 구매봇", createdAt: "방금 전" });
      } else if (completed?.payload?.sheetSync) {
        next.files.unshift({
          id: `file-${Date.now()}`,
          name: `${completed.payload.sheetSync.target}-sync-log.json`,
          source: completed.botName,
          createdAt: "방금 전"
        });
      }
    });
  }

  function approveRun(runId) {
    updateCurrentChannel((next) => {
      next.botRuns = next.botRuns.map((run) => (
        run.id === runId
          ? { ...run, status: "승인 완료", approvalStatus: "승인 완료", summary: "담당자가 결제를 승인했습니다. 구매봇이 최종 결제 단계로 진행할 수 있습니다." }
          : run
      ));
    });
  }

  function rejectRun(runId) {
    updateCurrentChannel((next) => {
      next.botRuns = next.botRuns.map((run) => (
        run.id === runId
          ? { ...run, status: "반려", approvalStatus: "반려", summary: "담당자가 자동 구매 실행을 반려했습니다." }
          : run
      ));
    });
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
