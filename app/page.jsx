"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "mattermost-project-mvp-next";
const currentUser = "@박민수";
const channelName = "구매요청";

const people = [
  { handle: "@유경화", name: "유경화", team: "플라워팀", avatar: "유" },
  { handle: "@박민수", name: "박민수", team: "구매팀", avatar: "박" },
  { handle: "@디자인팀", name: "디자인팀", team: "Team", avatar: "디" },
  { handle: "@성원에프디아이", name: "성원에프디아이", team: "협력사", avatar: "성" }
];

const defaultBots = [
  {
    id: "bot-1",
    name: "Codex 구매봇",
    provider: "Codex",
    command: "/codex",
    webhook: "https://automation.internal/codex/purchase",
    enabled: true
  },
  {
    id: "bot-2",
    name: "Claude 리뷰봇",
    provider: "Claude Code",
    command: "/claude-review",
    webhook: "https://automation.internal/claude/review",
    enabled: true
  }
];

const seedProject = {
  messages: [
    {
      id: "msg-1",
      author: "@유경화",
      body: "베이커리 포장재 구매요청을 Ideas에 등록했습니다.",
      createdAt: "May 21 at 1:26 PM",
      bot: false
    },
    {
      id: "msg-2",
      author: "@Codex 구매봇",
      body: "구매요청 3건을 요약했습니다. 미완료 2건, 완료 1건입니다.",
      createdAt: "Today at 9:55 AM",
      bot: true
    }
  ],
  botRuns: [
    {
      id: "run-1",
      botId: "bot-1",
      botName: "Codex 구매봇",
      provider: "Codex",
      command: "/codex 구매요청 요약",
      status: "승인 대기",
      requestedBy: "@박민수",
      createdAt: "Today at 9:55 AM",
      duration: "2.4s",
      summary: "구매요청을 정리하고 장바구니 준비 단계까지 완료했습니다.",
      approvalStatus: "승인 대기",
      purchaseStage: "장바구니 준비 완료",
      payload: {
        project: "onemoment",
        channel: "구매요청",
        command: "/codex 구매요청 요약",
        requester: "@박민수",
        openPosts: 2,
        approvalRequired: true,
        finalPaymentMode: "human_approval_required",
        buyerBotHost: "mac-mini-purchase-bot",
        vendorTargets: ["coupang", "gmarket"]
      }
    }
  ],
  files: [
    { id: "file-1", name: "shopping-bag-sample.pdf", source: "Ideas 첨부", owner: "@박민수", size: "1.8 MB" },
    { id: "file-2", name: "purchase-summary.md", source: "Codex 구매봇", owner: "@Codex 구매봇", size: "24 KB" }
  ],
  posts: [
    {
      id: "post-1",
      title: "베이커리 포장재 구매요청",
      body:
        "[구매요청]\n1. 이름/소속 : 유경화/플라워팀\n2. 주문상품 내역 :\n- 락스 / 1\n- 버터무릉 스티커 / 1\n- 디자인 샘플용 부자재 / 1개씩\n\n@박민수 확인 부탁드립니다.",
      status: "검토중",
      author: "@유경화",
      createdAt: "May 21 at 1:26 PM",
      link: "link.coupang.com/a/dU8MJL4A5A",
      reactions: 4,
      comments: [
        { id: "comment-1", author: "@박민수", body: "품목 확인했습니다. 납기일만 추가해주시면 바로 발주 진행하겠습니다." },
        { id: "comment-2", author: "@유경화", body: "@박민수 금요일 오전까지 필요합니다." }
      ]
    },
    {
      id: "post-2",
      title: "쇼핑백 샘플 업체 비교",
      body: "새 쇼핑백 샘플 단가를 비교했습니다. @디자인팀 색상 검토 부탁드립니다.",
      status: "진행중",
      author: "@박민수",
      createdAt: "Today at 9:42 AM",
      link: "docs.internal/shopping-bag-sample",
      reactions: 2,
      comments: []
    },
    {
      id: "post-3",
      title: "완료: 리본 재고 보충",
      body: "리본 3종 재고 보충 완료했습니다. 다음 입고 예정일은 다음 주 화요일입니다.",
      status: "완료",
      author: "@성원에프디아이",
      createdAt: "Yesterday at 4:10 PM",
      link: "",
      reactions: 6,
      comments: [{ id: "comment-3", author: "@박민수", body: "확인했습니다. 감사합니다." }]
    }
  ]
};

function emptyProjectData(projectName) {
  return {
    messages: [
      {
        id: `msg-${Date.now()}`,
        author: "@시스템",
        body: `${projectName} 프로젝트 채널이 생성되었습니다.`,
        createdAt: "Just now",
        bot: true
      }
    ],
    botRuns: [],
    files: [],
    posts: []
  };
}

function defaultState() {
  return {
    selectedProjectId: "project-1",
    bots: structuredClone(defaultBots),
    projects: [
      { id: "project-1", name: "onemoment", channel: channelName, ...structuredClone(seedProject) },
      { id: "project-2", name: "ERP 고도화", channel: channelName, ...emptyProjectData("ERP 고도화") },
      { id: "project-3", name: "모바일 앱", channel: channelName, ...emptyProjectData("모바일 앱") },
      { id: "project-4", name: "보안 점검", channel: channelName, ...emptyProjectData("보안 점검") }
    ]
  };
}

function initials(handle) {
  return people.find((person) => person.handle === handle)?.avatar ?? handle.replace("@", "").slice(0, 1).toUpperCase();
}

function statusTone(status) {
  if (status === "승인됨" || status === "성공" || status === "완료") return "chip";
  if (status === "실행중" || status === "진행중") return "chip blue";
  if (status === "반려" || status === "실패") return "chip danger";
  return "chip amber";
}

function MentionText({ text }) {
  const parts = String(text).split(/(@[가-힣A-Za-z0-9_]+)/g);
  return parts.map((part, index) =>
    part.startsWith("@") ? (
      <span className="mention" key={`${part}-${index}`}>{part}</span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export default function Home() {
  const [state, setState] = useState(defaultState);
  const [activeTab, setActiveTab] = useState("ideas");
  const [activeFilter, setActiveFilter] = useState("all");
  const [postDraft, setPostDraft] = useState({ title: "", body: "", status: "검토중" });
  const [messageDraft, setMessageDraft] = useState("");
  const [botDraft, setBotDraft] = useState({ name: "", provider: "Codex", command: "", webhook: "" });
  const [projectDraft, setProjectDraft] = useState("");
  const [fileDraft, setFileDraft] = useState({ name: "", source: "수동 추가" });
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        setState(defaultState());
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const project = useMemo(
    () => state.projects.find((item) => item.id === state.selectedProjectId) ?? state.projects[0],
    [state]
  );

  const filteredPosts = useMemo(() => {
    if (activeFilter === "mentions") {
      return project.posts.filter(
        (post) => post.body.includes(currentUser) || post.comments.some((comment) => comment.body.includes(currentUser))
      );
    }
    if (activeFilter === "open") {
      return project.posts.filter((post) => post.status !== "완료");
    }
    return project.posts;
  }, [activeFilter, project.posts]);

  const counts = useMemo(
    () => ({
      review: project.posts.filter((post) => post.status === "검토중").length,
      progress: project.posts.filter((post) => post.status === "진행중").length,
      done: project.posts.filter((post) => post.status === "완료").length
    }),
    [project.posts]
  );

  function updateProject(mutator) {
    setState((current) => ({
      ...current,
      projects: current.projects.map((item) => {
        if (item.id !== current.selectedProjectId) return item;
        const next = structuredClone(item);
        mutator(next);
        return next;
      })
    }));
  }

  function addMessage(author, body, bot = false) {
    updateProject((next) => {
      next.messages.push({ id: `msg-${Date.now()}`, author, body, createdAt: "Just now", bot });
    });
  }

  function createProject(event) {
    event.preventDefault();
    const name = projectDraft.trim();
    if (!name) return;
    const newProject = { id: `project-${Date.now()}`, name, channel: channelName, ...emptyProjectData(name) };
    setState((current) => ({
      ...current,
      selectedProjectId: newProject.id,
      projects: [...current.projects, newProject]
    }));
    setProjectDraft("");
    setShowProjectDialog(false);
  }

  function createPost(event) {
    event.preventDefault();
    if (!postDraft.title.trim() || !postDraft.body.trim()) return;
    updateProject((next) => {
      next.posts.unshift({
        id: `post-${Date.now()}`,
        title: postDraft.title.trim(),
        body: postDraft.body.trim(),
        status: postDraft.status,
        author: currentUser,
        createdAt: "Just now",
        link: postDraft.body.split(/\s+/).find((part) => /^https?:\/\//.test(part)) ?? "",
        reactions: 0,
        comments: []
      });
      next.messages.push({
        id: `msg-${Date.now()}`,
        author: currentUser,
        body: `Ideas에 새 게시글을 등록했습니다: ${postDraft.title.trim()}`,
        createdAt: "Just now",
        bot: false
      });
    });
    setPostDraft({ title: "", body: "", status: "검토중" });
  }

  function addComment(postId, body) {
    if (!body.trim()) return;
    updateProject((next) => {
      const post = next.posts.find((item) => item.id === postId);
      if (!post) return;
      post.comments.push({ id: `comment-${Date.now()}`, author: currentUser, body: body.trim() });
      next.messages.push({
        id: `msg-${Date.now()}`,
        author: currentUser,
        body: `댓글을 남겼습니다: ${post.title}`,
        createdAt: "Just now",
        bot: false
      });
    });
  }

  function changePostStatus(postId, status) {
    updateProject((next) => {
      const post = next.posts.find((item) => item.id === postId);
      if (!post) return;
      post.status = status;
      next.messages.push({
        id: `msg-${Date.now()}`,
        author: "@시스템",
        body: `${post.title} 상태가 ${status}(으)로 변경되었습니다.`,
        createdAt: "Just now",
        bot: true
      });
    });
  }

  function buildBotPayload(bot, commandText, workingProject = project) {
    const openPosts = workingProject.posts.filter((post) => post.status !== "완료");
    const mentions = [...new Set(workingProject.posts.flatMap((post) => `${post.body} ${post.comments.map((c) => c.body).join(" ")}`.match(/@[가-힣A-Za-z0-9_]+/g) ?? []))];
    return {
      project: workingProject.name,
      channel: workingProject.channel,
      provider: bot.provider,
      bot: bot.name,
      command: commandText || bot.command,
      webhook: bot.webhook,
      requester: currentUser,
      openPosts: openPosts.length,
      approvalRequired: true,
      finalPaymentMode: "human_approval_required",
      buyerBotHost: "mac-mini-purchase-bot",
      browserAutomation: {
        mode: "remote_browser_control",
        allowedUntil: "checkout_review",
        stopBeforePayment: true,
        recordOrderResult: true
      },
      vendorTargets: ["coupang", "gmarket"],
      mentions,
      posts: openPosts.map((post) => ({ id: post.id, title: post.title, status: post.status, author: post.author }))
    };
  }

  function runBot(botId, commandText = "") {
    const bot = state.bots.find((item) => item.id === botId);
    if (!bot) return;
    const command = commandText || `${bot.command} 구매요청 요약`;
    const runId = `run-${Date.now()}`;
    const targetProjectId = state.selectedProjectId;
    updateProject((next) => {
      const openPosts = next.posts.filter((post) => post.status !== "완료").length;
      next.botRuns.unshift({
        id: runId,
        botId: bot.id,
        botName: bot.name,
        provider: bot.provider,
        command,
        status: "실행중",
        requestedBy: currentUser,
        createdAt: "Just now",
        duration: "진행중",
        summary: `맥미니 구매봇 Webhook 호출 대기 중입니다. 미완료 구매요청 ${openPosts}건을 전송합니다.`,
        purchaseStage: "요청 접수",
        approvalStatus: "준비 중",
        payload: buildBotPayload(bot, command, next)
      });
      next.messages.push({
        id: `msg-${Date.now()}`,
        author: "@시스템",
        body: `${bot.name} 실행을 시작했습니다: ${command}. 실제 결제는 승인 전까지 진행하지 않습니다.`,
        createdAt: "Just now",
        bot: true
      });
    });
    window.setTimeout(() => completeRun(targetProjectId, runId), 900);
  }

  function completeRun(projectId, runId) {
    setState((current) => ({
      ...current,
      projects: current.projects.map((item) => {
        if (item.id !== projectId) return item;
        const next = structuredClone(item);
        const run = next.botRuns.find((candidate) => candidate.id === runId);
        if (!run || run.status !== "실행중") return next;
        const openPosts = next.posts.filter((post) => post.status !== "완료").length;
        run.status = "승인 대기";
        run.duration = "2.1s";
        run.purchaseStage = "장바구니 준비 완료";
        run.approvalStatus = "승인 대기";
        run.summary = `미완료 구매요청 ${openPosts}건을 정리했고 맥미니 구매봇이 결제 직전 단계까지 준비할 수 있습니다. 최종 결제는 담당자 승인이 필요합니다.`;
        next.messages.push({
          id: `msg-${Date.now()}`,
          author: `@${run.botName}`,
          body: `${run.command} 처리 준비 완료: ${run.summary}`,
          createdAt: "Just now",
          bot: true
        });
        next.files.unshift({
          id: `file-${Date.now()}`,
          name: `${run.botName}-purchase-draft-${run.id}.md`,
          source: run.provider,
          owner: `@${run.botName}`,
          size: "8 KB"
        });
        return next;
      })
    }));
  }

  function approveRun(runId) {
    updateProject((next) => {
      const run = next.botRuns.find((item) => item.id === runId);
      if (!run || run.approvalStatus !== "승인 대기") return;
      run.status = "승인됨";
      run.approvalStatus = "승인됨";
      run.purchaseStage = "구매 승인 완료";
      run.summary = "담당자가 구매를 승인했습니다. 맥미니 구매봇은 결제 화면에서 사람이 최종 결제를 진행한 뒤 주문번호를 기록해야 합니다.";
      run.payload.approvedBy = currentUser;
      run.payload.approvedAt = new Date().toISOString();
      run.payload.nextAction = "human_complete_payment_and_record_order";
      next.messages.push({
        id: `msg-${Date.now()}`,
        author: "@시스템",
        body: `${run.botName} 구매 초안이 승인되었습니다. 결제 화면에서 담당자가 최종 결제를 진행하세요.`,
        createdAt: "Just now",
        bot: true
      });
      next.files.unshift({
        id: `file-${Date.now()}`,
        name: `${run.botName}-approval-${run.id}.md`,
        source: "구매 승인",
        owner: currentUser,
        size: "4 KB"
      });
    });
  }

  function rejectRun(runId) {
    updateProject((next) => {
      const run = next.botRuns.find((item) => item.id === runId);
      if (!run || run.approvalStatus !== "승인 대기") return;
      run.status = "반려";
      run.approvalStatus = "반려";
      run.purchaseStage = "구매 반려";
      run.summary = "담당자가 구매 초안을 반려했습니다. 구매요청 게시글을 수정한 뒤 다시 실행할 수 있습니다.";
      run.payload.rejectedBy = currentUser;
      run.payload.rejectedAt = new Date().toISOString();
      run.payload.nextAction = "revise_purchase_request";
      next.messages.push({
        id: `msg-${Date.now()}`,
        author: "@시스템",
        body: `${run.botName} 구매 초안이 반려되었습니다. 요청 내용을 수정한 뒤 다시 실행하세요.`,
        createdAt: "Just now",
        bot: true
      });
    });
  }

  function submitMessage(event) {
    event.preventDefault();
    const body = messageDraft.trim();
    if (!body) return;
    const bot = state.bots.find((item) => body.startsWith(item.command));
    addMessage(currentUser, body);
    setMessageDraft("");
    if (bot) runBot(bot.id, body);
  }

  function addBot(event) {
    event.preventDefault();
    if (!botDraft.name.trim() || !botDraft.command.trim()) return;
    setState((current) => ({
      ...current,
      bots: [
        ...current.bots,
        {
          id: `bot-${Date.now()}`,
          name: botDraft.name.trim(),
          provider: botDraft.provider,
          command: botDraft.command.trim(),
          webhook: botDraft.webhook.trim(),
          enabled: true
        }
      ]
    }));
    addMessage("@시스템", `${botDraft.name.trim()} 봇이 ${botDraft.command.trim()} 명령어로 연결되었습니다.`, true);
    setBotDraft({ name: "", provider: "Codex", command: "", webhook: "" });
  }

  function addFile(event) {
    event.preventDefault();
    if (!fileDraft.name.trim()) return;
    updateProject((next) => {
      next.files.unshift({
        id: `file-${Date.now()}`,
        name: fileDraft.name.trim(),
        source: fileDraft.source.trim() || "수동 추가",
        owner: currentUser,
        size: "512 KB"
      });
      next.messages.push({
        id: `msg-${Date.now()}`,
        author: currentUser,
        body: `파일을 추가했습니다: ${fileDraft.name.trim()}`,
        createdAt: "Just now",
        bot: false
      });
    });
    setFileDraft({ name: "", source: "수동 추가" });
    setShowFileDialog(false);
  }

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Primary navigation">
        <button className="rail-button active" title="Channels"><span className="icon">#</span></button>
        <button className="rail-button" title="Mentions"><span className="icon">@</span></button>
        <button className="rail-button" title="Files"><span className="icon">F</span></button>
        <button className="rail-button rail-bottom" title="Settings"><span className="icon">S</span></button>
      </aside>

      <aside className="sidebar">
        <header className="workspace-header">
          <div>
            <strong>onemoment</strong>
            <span>captain@1moment.co.kr</span>
          </div>
          <button className="icon-button" title="워크스페이스 메뉴">⌄</button>
        </header>

        <section className="project-switcher">
          <label htmlFor="projectSelect">프로젝트</label>
          <select
            id="projectSelect"
            value={state.selectedProjectId}
            onChange={(event) => {
              setState((current) => ({ ...current, selectedProjectId: event.target.value }));
              setActiveFilter("all");
            }}
          >
            {state.projects.map((item) => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
          <button className="icon-button" title="프로젝트 생성" onClick={() => setShowProjectDialog(true)}>＋</button>
        </section>

        <nav className="channel-list" aria-label="Project channels">
          <div className="list-heading">Unread</div>
          <button className="channel-item"><span>양재_당일배송</span><b>1</b></button>
          <button className="channel-item"><span>꽃 입고 관리</span><b>8</b></button>
          <button className="channel-item"><span>꽃 폐기 관리</span><b>47</b></button>
          <div className="list-heading with-action"><span>Starred</span><span>★</span></div>
          <button className="channel-item muted"><span>매니저 소통</span></button>
          <button className="channel-item muted"><span>결제관련</span></button>
          <button className="channel-item active"><span>{project.channel}</span></button>
          <button className="channel-item muted"><span>베이커리_원모</span></button>
          <button className="channel-item muted"><span>플라워 운영</span></button>
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{project.channel} <span>⌄</span> <mark>★</mark></h1>
            <nav className="tabs" aria-label="Project tabs">
              {["messages", "ideas", "files"].map((tab) => (
                <button className={activeTab === tab ? "active" : ""} data-tab={tab} key={tab} onClick={() => setActiveTab(tab)}>
                  {tab === "messages" ? "Messages" : tab === "ideas" ? "Ideas" : "Files"}
                </button>
              ))}
            </nav>
          </div>
          <div className="top-actions">
            <button className="icon-button" title="검색">⌕</button>
            <button className="icon-button" title="알림">!</button>
            <button className="profile-dot" title="내 프로필">박</button>
          </div>
        </header>

        {activeTab === "messages" && (
          <section className="view content-grid">
            <section className="feed">
              <div className="message-stream">
                {project.messages.map((message) => (
                  <article className={`message-row ${message.bot ? "bot-message" : ""}`} key={message.id}>
                    <div className="avatar">{initials(message.author)}</div>
                    <div>
                      <div className="message-meta">
                        <strong>{message.author}</strong>
                        {message.bot && <span className="chip blue">Bot</span>}
                        <span>{message.createdAt}</span>
                      </div>
                      <p><MentionText text={message.body} /></p>
                    </div>
                  </article>
                ))}
              </div>
              <form className="message-composer" onSubmit={submitMessage}>
                <input value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="메시지를 입력하세요. 예: /codex 구매요청 요약" />
                <button className="primary-button" type="submit">전송</button>
              </form>
            </section>
            <aside className="inspector">
              <BotPanel bots={state.bots} onRun={runBot} />
              <BotForm draft={botDraft} setDraft={setBotDraft} onSubmit={addBot} />
              <RunList runs={project.botRuns} onApprove={approveRun} onReject={rejectRun} />
            </aside>
          </section>
        )}

        {activeTab === "ideas" && (
          <section className="view content-grid">
            <section className="feed">
              <form className="composer" onSubmit={createPost}>
                <input className="title-input" value={postDraft.title} onChange={(event) => setPostDraft({ ...postDraft, title: event.target.value })} placeholder="제목을 입력하세요" maxLength={80} />
                <div className="body-field">
                  <textarea value={postDraft.body} onChange={(event) => setPostDraft({ ...postDraft, body: event.target.value })} placeholder="구매요청, 아이디어, 공지사항을 공유하세요" rows={4} />
                </div>
                <div className="composer-tools">
                  <div className="tool-group">
                    <button type="button" className="tool-button" title="첨부">＋</button>
                    <button type="button" className="tool-button" title="서식">Aa</button>
                    <button type="button" className="tool-button" title="멘션">@</button>
                    <button type="button" className="tool-button" title="이모지">☺</button>
                  </div>
                  <div className="status-actions">
                    <select value={postDraft.status} onChange={(event) => setPostDraft({ ...postDraft, status: event.target.value })} aria-label="게시글 상태">
                      <option value="검토중">검토중</option>
                      <option value="진행중">진행중</option>
                      <option value="완료">완료</option>
                    </select>
                    <button type="button" className="secondary-button" onClick={() => setPostDraft({ title: "", body: "", status: "검토중" })}>취소</button>
                    <button className="primary-button" type="submit">게시</button>
                  </div>
                </div>
              </form>

              <div className="feed-header">
                <div>
                  <h2>Ideas</h2>
                  <p>게시글, 댓글, 멘션으로 업무 요청을 추적합니다.</p>
                </div>
                <div className="segmented" role="group" aria-label="Feed filter">
                  {[
                    ["all", "전체"],
                    ["mentions", "내 멘션"],
                    ["open", "미완료"]
                  ].map(([value, label]) => (
                    <button className={activeFilter === value ? "active" : ""} data-filter={value} key={value} onClick={() => setActiveFilter(value)}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="post-list">
                {filteredPosts.length === 0 ? (
                  <div className="empty-state">
                    <h2>표시할 게시글이 없습니다</h2>
                    <p>다른 필터를 선택하거나 새 게시글을 작성해보세요.</p>
                  </div>
                ) : (
                  filteredPosts.map((post) => (
                    <PostCard post={post} key={post.id} onComment={addComment} onStatusChange={changePostStatus} />
                  ))
                )}
              </div>
            </section>
            <aside className="inspector">
              <section className="panel">
                <div className="panel-title"><h2>공지</h2><span className="chip amber">고정</span></div>
                <p>구매요청은 품목, 수량, 납기일, 담당자를 포함해 등록해주세요.</p>
              </section>
              <section className="panel">
                <h2>요약</h2>
                <div className="metric-row"><span>검토중</span><strong>{counts.review}</strong></div>
                <div className="metric-row"><span>진행중</span><strong>{counts.progress}</strong></div>
                <div className="metric-row"><span>완료</span><strong>{counts.done}</strong></div>
              </section>
              <section className="panel">
                <h2>자동화 실행</h2>
                <p>구매봇은 상품 정보를 정리하고 맥미니 원격 브라우저에서 장바구니/결제 직전 단계까지 준비합니다. 최종 결제는 담당자가 승인합니다.</p>
                <div className="bot-list">
                  {state.bots.map((bot) => <BotCard bot={bot} key={bot.id} onRun={runBot} />)}
                </div>
              </section>
              <RunList title="최근 봇 실행" runs={project.botRuns} onApprove={approveRun} onReject={rejectRun} />
              <section className="panel">
                <h2>내 멘션</h2>
                <div className="mention-list">
                  {project.posts.filter((post) => post.body.includes(currentUser)).slice(0, 3).map((post) => (
                    <div className="mention-item" key={post.id}><strong>{post.title}</strong><span>{post.status}</span></div>
                  ))}
                </div>
              </section>
            </aside>
          </section>
        )}

        {activeTab === "files" && (
          <section className="view content-grid">
            <section className="feed">
              <div className="feed-header">
                <div>
                  <h2>Files</h2>
                  <p>게시글, 댓글, 봇 실행 결과에 연결된 파일을 모아봅니다.</p>
                </div>
                <button className="primary-button" type="button" onClick={() => setShowFileDialog(true)}>파일 추가</button>
              </div>
              <div className="file-list">
                {project.files.length === 0 ? (
                  <div className="empty-state"><h2>파일이 없습니다</h2><p>파일을 추가하거나 봇을 실행하면 결과 파일이 여기에 표시됩니다.</p></div>
                ) : (
                  project.files.map((file) => (
                    <article className="file-row" key={file.id}>
                      <div className="file-icon">DOC</div>
                      <div><strong>{file.name}</strong><span>{file.source} · {file.owner} · {file.size}</span></div>
                      <button className="secondary-button" type="button">열기</button>
                    </article>
                  ))
                )}
              </div>
            </section>
            <aside className="inspector">
              <section className="panel">
                <h2>파일 연동</h2>
                <p>MVP에서는 파일 메타데이터를 관리합니다. 실제 저장소는 Mattermost 파일 API, Google Drive, S3 중 하나로 연결할 수 있습니다.</p>
              </section>
            </aside>
          </section>
        )}
      </main>

      {showProjectDialog && (
        <div className="next-dialog-fallback">
          <form className="dialog-card" onSubmit={createProject}>
            <h2>프로젝트 생성</h2>
            <label>프로젝트명<input value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} placeholder="예: 신규 매장 오픈" maxLength={40} /></label>
            <menu><button type="button" className="secondary-button" onClick={() => setShowProjectDialog(false)}>취소</button><button className="primary-button" type="submit">생성</button></menu>
          </form>
        </div>
      )}

      {showFileDialog && (
        <div className="next-dialog-fallback">
          <form className="dialog-card" onSubmit={addFile}>
            <h2>파일 추가</h2>
            <label>파일명<input value={fileDraft.name} onChange={(event) => setFileDraft({ ...fileDraft, name: event.target.value })} placeholder="예: purchase-summary.md" maxLength={80} /></label>
            <label>출처<input value={fileDraft.source} onChange={(event) => setFileDraft({ ...fileDraft, source: event.target.value })} placeholder="예: Ideas 첨부" maxLength={40} /></label>
            <menu><button type="button" className="secondary-button" onClick={() => setShowFileDialog(false)}>취소</button><button className="primary-button" type="submit">추가</button></menu>
          </form>
        </div>
      )}
    </div>
  );
}

function BotPanel({ bots, onRun }) {
  return (
    <section className="panel">
      <div className="panel-title"><h2>자동화봇</h2><span className="chip blue">Beta</span></div>
      <p>Claude Code나 Codex로 만든 봇을 채널 명령어 또는 Webhook으로 연결합니다.</p>
      <div className="bot-list">{bots.map((bot) => <BotCard bot={bot} key={bot.id} onRun={onRun} />)}</div>
    </section>
  );
}

function BotCard({ bot, onRun }) {
  return (
    <div className="bot-card">
      <div><strong>{bot.name}</strong><span>{bot.provider} · {bot.command}</span></div>
      <button className="secondary-button run-bot" type="button" onClick={() => onRun(bot.id)}>실행</button>
    </div>
  );
}

function BotForm({ draft, setDraft, onSubmit }) {
  return (
    <section className="panel">
      <h2>봇 등록</h2>
      <form className="bot-form" onSubmit={onSubmit}>
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="봇 이름" />
        <select value={draft.provider} onChange={(event) => setDraft({ ...draft, provider: event.target.value })} aria-label="봇 종류">
          <option value="Codex">Codex</option>
          <option value="Claude Code">Claude Code</option>
          <option value="Custom Webhook">Custom Webhook</option>
        </select>
        <input value={draft.command} onChange={(event) => setDraft({ ...draft, command: event.target.value })} placeholder="명령어 예: /codex" />
        <input value={draft.webhook} onChange={(event) => setDraft({ ...draft, webhook: event.target.value })} placeholder="Webhook URL 또는 실행 엔드포인트" />
        <button className="primary-button" type="submit">봇 추가</button>
      </form>
    </section>
  );
}

function RunList({ title = "실행 로그", runs, onApprove, onReject }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="run-list">
        {runs.length === 0 ? (
          <div className="mention-item"><strong>없음</strong><span>실행 로그 없음</span></div>
        ) : (
          runs.slice(0, 6).map((run) => (
            <article className="run-card" key={run.id}>
              <div className="run-head">
                <div><strong>{run.botName}</strong><span>{run.command}</span></div>
                <span className={statusTone(run.status)}>{run.status}</span>
              </div>
              <div className="run-meta"><span>{run.requestedBy}</span><span>{run.createdAt}</span><span>{run.duration}</span></div>
              <p>{run.summary}</p>
              {run.approvalStatus && (
                <div className="approval-box">
                  <div><strong>{run.purchaseStage ?? "구매 준비"}</strong><span>{run.approvalStatus}</span></div>
                  {run.approvalStatus === "승인 대기" && (
                    <div className="approval-actions">
                      <button className="primary-button" type="button" onClick={() => onApprove(run.id)}>구매 승인</button>
                      <button className="secondary-button" type="button" onClick={() => onReject(run.id)}>반려</button>
                    </div>
                  )}
                </div>
              )}
              <details><summary>Webhook payload 보기</summary><pre>{JSON.stringify(run.payload, null, 2)}</pre></details>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function PostCard({ post, onComment, onStatusChange }) {
  const [reply, setReply] = useState("");

  return (
    <article className="post-card">
      <div className="post-head">
        <div className="avatar">{initials(post.author)}</div>
        <div>
          <div className="post-title-row">
            <h3>{post.title}</h3>
            <select className="status-select" value={post.status} onChange={(event) => onStatusChange(post.id, event.target.value)} aria-label="상태 변경">
              <option value="검토중">검토중</option>
              <option value="진행중">진행중</option>
              <option value="완료">완료</option>
            </select>
          </div>
          <div className="post-meta">{post.author} · {post.createdAt}</div>
        </div>
        <div className="post-actions"><button className="icon-button" title="공유">↗</button><button className="icon-button" title="북마크">♡</button></div>
      </div>
      <div className="post-body"><MentionText text={post.body} /></div>
      {post.link && (
        <div className="link-preview">
          <div><strong>첨부 링크</strong><span>{post.link}</span></div>
          <button className="secondary-button">열기</button>
        </div>
      )}
      <div className="post-footer"><span>좋아요 {post.reactions}</span><span>댓글 {post.comments.length}</span><span>멘션 {(post.body.match(/@[가-힣A-Za-z0-9_]+/g) ?? []).length}</span></div>
      <section className="comments" aria-label="댓글">
        {post.comments.map((comment) => (
          <div className="comment" key={comment.id}>
            <div className="avatar">{initials(comment.author)}</div>
            <div className="comment-body"><strong>{comment.author}</strong><MentionText text={comment.body} /></div>
          </div>
        ))}
        <form
          className="reply-form"
          onSubmit={(event) => {
            event.preventDefault();
            onComment(post.id, reply);
            setReply("");
          }}
        >
          <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="댓글을 입력하세요..." aria-label="댓글을 입력하세요" />
          <button className="primary-button" type="submit">댓글</button>
        </form>
      </section>
    </article>
  );
}
