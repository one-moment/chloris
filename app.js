const STORAGE_KEY = "mattermost-project-mvp-v3";
const currentUser = "@박민수";
const channelName = "구매요청";

const people = [
  { handle: "@유경화", name: "유경화", team: "플라워팀", avatar: "유" },
  { handle: "@박민수", name: "박민수", team: "구매팀", avatar: "박" },
  { handle: "@디자인팀", name: "디자인팀", team: "Team", avatar: "디" },
  { handle: "@성원에프디아이", name: "성원에프디아이", team: "협력사", avatar: "성" },
];

const sharedBots = [
  {
    id: "bot-1",
    name: "Codex 구매봇",
    provider: "Codex",
    command: "/codex",
    webhook: "https://automation.internal/codex/purchase",
    enabled: true,
  },
  {
    id: "bot-2",
    name: "Claude 리뷰봇",
    provider: "Claude Code",
    command: "/claude-review",
    webhook: "https://automation.internal/claude/review",
    enabled: true,
  },
];

const defaultProjectData = {
  messages: [
    {
      id: "msg-1",
      author: "@유경화",
      body: "베이커리 포장재 구매요청을 Ideas에 등록했습니다.",
      createdAt: "May 21 at 1:26 PM",
      bot: false,
    },
    {
      id: "msg-2",
      author: "@Codex 구매봇",
      body: "구매요청 3건을 요약했습니다. 미완료 2건, 완료 1건입니다.",
      createdAt: "Today at 9:55 AM",
      bot: true,
    },
  ],
  botRuns: [
    {
      id: "run-1",
      botId: "bot-1",
      botName: "Codex 구매봇",
      provider: "Codex",
      command: "/codex 구매요청 요약",
      status: "성공",
      requestedBy: "@박민수",
      createdAt: "Today at 9:55 AM",
      duration: "2.4s",
      summary: "구매요청을 정리하고 장바구니 준비 단계까지 완료했습니다.",
      approvalStatus: "승인 대기",
      purchaseStage: "승인 대기",
      payload: {
        project: "onemoment",
        channel: "구매요청",
        command: "/codex 구매요청 요약",
        requester: "@박민수",
        openPosts: 2,
        approvalRequired: true,
        finalPaymentMode: "human_approval_required",
        buyerBotHost: "mac-mini-purchase-bot",
        vendorTargets: ["coupang", "gmarket"],
      },
    },
  ],
  files: [
    { id: "file-1", name: "shopping-bag-sample.pdf", source: "Ideas 첨부", owner: "@박민수", size: "1.8 MB" },
    { id: "file-2", name: "purchase-summary.md", source: "Codex 구매봇", owner: "@Codex 구매봇", size: "24 KB" },
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
        {
          id: "comment-1",
          author: "@박민수",
          body: "품목 확인했습니다. 납기일만 추가해주시면 바로 발주 진행하겠습니다.",
        },
        {
          id: "comment-2",
          author: "@유경화",
          body: "@박민수 금요일 오전까지 필요합니다.",
        },
      ],
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
      comments: [],
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
      comments: [{ id: "comment-3", author: "@박민수", body: "확인했습니다. 감사합니다." }],
    },
  ],
};

const defaultState = {
  selectedProjectId: "project-1",
  projects: [
    { id: "project-1", name: "onemoment", channel: "구매요청", ...structuredClone(defaultProjectData) },
    { id: "project-2", name: "ERP 고도화", channel: "구매요청", ...emptyProjectData("ERP 고도화") },
    { id: "project-3", name: "모바일 앱", channel: "구매요청", ...emptyProjectData("모바일 앱") },
    { id: "project-4", name: "보안 점검", channel: "구매요청", ...emptyProjectData("보안 점검") },
  ],
  bots: structuredClone(sharedBots),
};

let state = loadState();
let activeFilter = "all";

const els = {
  projectSelect: document.querySelector("#projectSelect"),
  newProjectBtn: document.querySelector("#newProjectBtn"),
  projectDialog: document.querySelector("#projectDialog"),
  projectForm: document.querySelector("#projectForm"),
  closeProjectDialog: document.querySelector("#closeProjectDialog"),
  newProjectName: document.querySelector("#newProjectName"),
  fileDialog: document.querySelector("#fileDialog"),
  fileForm: document.querySelector("#fileForm"),
  closeFileDialog: document.querySelector("#closeFileDialog"),
  newFileName: document.querySelector("#newFileName"),
  newFileSource: document.querySelector("#newFileSource"),
  channelTitle: document.querySelector("#channelTitle"),
  activeChannelLabel: document.querySelector("#activeChannelLabel"),
  tabs: document.querySelectorAll(".tabs button"),
  views: {
    messages: document.querySelector("#messagesView"),
    ideas: document.querySelector("#ideasView"),
    files: document.querySelector("#filesView"),
  },
  messageList: document.querySelector("#messageList"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput"),
  botList: document.querySelector("#botList"),
  botForm: document.querySelector("#botForm"),
  botName: document.querySelector("#botName"),
  botProvider: document.querySelector("#botProvider"),
  botCommand: document.querySelector("#botCommand"),
  botWebhook: document.querySelector("#botWebhook"),
  ideaBotActions: document.querySelector("#ideaBotActions"),
  botRunList: document.querySelector("#botRunList"),
  ideaRunList: document.querySelector("#ideaRunList"),
  postForm: document.querySelector("#postForm"),
  postTitle: document.querySelector("#postTitle"),
  postBody: document.querySelector("#postBody"),
  postStatus: document.querySelector("#postStatus"),
  mentionBtn: document.querySelector("#mentionBtn"),
  mentionMenu: document.querySelector("#mentionMenu"),
  cancelPost: document.querySelector("#cancelPost"),
  postList: document.querySelector("#postList"),
  filterButtons: document.querySelectorAll(".segmented button"),
  reviewCount: document.querySelector("#reviewCount"),
  progressCount: document.querySelector("#progressCount"),
  doneCount: document.querySelector("#doneCount"),
  mentionList: document.querySelector("#mentionList"),
  fileList: document.querySelector("#fileList"),
  addFileBtn: document.querySelector("#addFileBtn"),
};

function emptyProjectData(projectName) {
  return {
    messages: [
      {
        id: `msg-${projectName}`,
        author: "@시스템",
        body: `${projectName} 프로젝트 채널이 생성되었습니다.`,
        createdAt: "Just now",
        bot: true,
      },
    ],
    botRuns: [],
    files: [],
    posts: [],
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(value) {
  if (Array.isArray(value.projects) && typeof value.projects[0] === "string") {
    return structuredClone(defaultState);
  }

  return {
    ...structuredClone(defaultState),
    ...value,
    bots: value.bots ?? structuredClone(sharedBots),
    projects: (value.projects ?? defaultState.projects).map((project) => ({
      channel: channelName,
      ...emptyProjectData(project.name ?? "새 프로젝트"),
      ...project,
      messages: project.messages ?? [],
      botRuns: project.botRuns ?? [],
      files: project.files ?? [],
      posts: project.posts ?? [],
    })),
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentProject() {
  return state.projects.find((project) => project.id === state.selectedProjectId) ?? state.projects[0];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMentionedText(value) {
  const escaped = escapeHtml(value);
  return escaped.replace(/(@[가-힣A-Za-z0-9_]+)/g, '<span class="mention">$1</span>');
}

function initials(handle) {
  const person = people.find((item) => item.handle === handle);
  if (person) return person.avatar;
  return handle.replace("@", "").slice(0, 1).toUpperCase();
}

function statusClass(status) {
  if (status === "완료") return "chip";
  if (status === "진행중") return "chip blue";
  return "chip amber";
}

function statusTone(status) {
  if (status === "성공") return "chip";
  if (status === "실행중") return "chip blue";
  if (status === "실패") return "chip danger";
  if (status === "승인 대기") return "chip amber";
  if (status === "승인됨") return "chip";
  if (status === "반려") return "chip danger";
  return "chip amber";
}

function renderProjects() {
  const project = currentProject();
  els.channelTitle.textContent = project.channel;
  els.activeChannelLabel.textContent = project.channel;
  els.projectSelect.innerHTML = state.projects
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}" ${
          item.id === project.id ? "selected" : ""
        }>${escapeHtml(item.name)}</option>`,
    )
    .join("");
}

function renderMessages() {
  const project = currentProject();
  els.messageList.innerHTML = project.messages
    .map(
      (message) => `
        <article class="message-row ${message.bot ? "bot-message" : ""}">
          <div class="avatar">${escapeHtml(initials(message.author))}</div>
          <div>
            <div class="message-meta">
              <strong>${escapeHtml(message.author)}</strong>
              ${message.bot ? '<span class="chip blue">Bot</span>' : ""}
              <span>${escapeHtml(message.createdAt)}</span>
            </div>
            <p>${renderMentionedText(message.body)}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function getFilteredPosts() {
  const posts = currentProject().posts;
  if (activeFilter === "mentions") {
    return posts.filter(
      (post) =>
        post.body.includes(currentUser) ||
        post.comments.some((comment) => comment.body.includes(currentUser)),
    );
  }

  if (activeFilter === "open") {
    return posts.filter((post) => post.status !== "완료");
  }

  return posts;
}

function renderPosts() {
  const posts = getFilteredPosts();

  els.postList.innerHTML = posts
    .map(
      (post) => `
        <article class="post-card">
          <div class="post-head">
            <div class="avatar">${escapeHtml(initials(post.author))}</div>
            <div>
              <div class="post-title-row">
                <h3>${escapeHtml(post.title)}</h3>
                <select class="status-select" data-post-id="${escapeHtml(post.id)}" aria-label="상태 변경">
                  ${["검토중", "진행중", "완료"]
                    .map(
                      (status) =>
                        `<option value="${status}" ${status === post.status ? "selected" : ""}>${status}</option>`,
                    )
                    .join("")}
                </select>
              </div>
              <div class="post-meta">${escapeHtml(post.author)} · ${escapeHtml(post.createdAt)}</div>
            </div>
            <div class="post-actions">
              <button class="icon-button" title="공유" aria-label="공유">↗</button>
              <button class="icon-button" title="북마크" aria-label="북마크">♡</button>
            </div>
          </div>
          <div class="post-body">${renderMentionedText(post.body)}</div>
          ${
            post.link
              ? `<div class="link-preview">
                  <div>
                    <strong>첨부 링크</strong>
                    <span>${escapeHtml(post.link)}</span>
                  </div>
                  <button class="secondary-button">열기</button>
                </div>`
              : ""
          }
          <div class="post-footer">
            <span>좋아요 ${post.reactions}</span>
            <span>댓글 ${post.comments.length}</span>
            <span>멘션 ${countMentions(post)}</span>
          </div>
          <section class="comments" aria-label="댓글">
            ${post.comments
              .map(
                (comment) => `
                  <div class="comment">
                    <div class="avatar">${escapeHtml(initials(comment.author))}</div>
                    <div class="comment-body">
                      <strong>${escapeHtml(comment.author)}</strong>
                      ${renderMentionedText(comment.body)}
                    </div>
                  </div>
                `,
              )
              .join("")}
            <form class="reply-form" data-post-id="${escapeHtml(post.id)}">
              <input placeholder="댓글을 입력하세요..." aria-label="댓글을 입력하세요">
              <button class="primary-button" type="submit">댓글</button>
            </form>
          </section>
        </article>
      `,
    )
    .join("");

  if (!posts.length) {
    els.postList.innerHTML = `
      <div class="empty-state">
        <h2>표시할 게시글이 없습니다</h2>
        <p>다른 필터를 선택하거나 새 게시글을 작성해보세요.</p>
      </div>
    `;
  }

  document.querySelectorAll(".reply-form").forEach((form) => {
    form.addEventListener("submit", handleReplySubmit);
  });
  document.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", handleStatusChange);
  });
}

function renderSummary() {
  const posts = currentProject().posts;
  els.reviewCount.textContent = posts.filter((post) => post.status === "검토중").length;
  els.progressCount.textContent = posts.filter((post) => post.status === "진행중").length;
  els.doneCount.textContent = posts.filter((post) => post.status === "완료").length;

  const mentions = posts
    .filter(
      (post) =>
        post.body.includes(currentUser) ||
        post.comments.some((comment) => comment.body.includes(currentUser)),
    )
    .slice(0, 3);

  els.mentionList.innerHTML = mentions.length
    ? mentions
        .map(
          (post) => `
            <div class="mention-item">
              <strong>${escapeHtml(post.title)}</strong>
              <span>${escapeHtml(post.status)}</span>
            </div>
          `,
        )
        .join("")
    : '<div class="mention-item"><strong>없음</strong><span>새 멘션 없음</span></div>';
}

function renderBots() {
  const botCards = state.bots
    .map(
      (bot) => `
        <div class="bot-card">
          <div>
            <strong>${escapeHtml(bot.name)}</strong>
            <span>${escapeHtml(bot.provider)} · ${escapeHtml(bot.command)}</span>
          </div>
          <button class="secondary-button run-bot" data-bot-id="${escapeHtml(bot.id)}" type="button">실행</button>
        </div>
      `,
    )
    .join("");

  els.botList.innerHTML = botCards;
  els.ideaBotActions.innerHTML = botCards;

  document.querySelectorAll(".run-bot").forEach((button) => {
    button.addEventListener("click", () => runBot(button.dataset.botId));
  });
}

function renderBotRuns() {
  const runs = currentProject().botRuns;
  const html = runs
    .slice(0, 6)
    .map(
      (run) => `
        <article class="run-card">
          <div class="run-head">
            <div>
              <strong>${escapeHtml(run.botName)}</strong>
              <span>${escapeHtml(run.command)}</span>
            </div>
            <span class="${statusTone(run.status)}">${escapeHtml(run.status)}</span>
          </div>
          <div class="run-meta">
            <span>${escapeHtml(run.requestedBy)}</span>
            <span>${escapeHtml(run.createdAt)}</span>
            <span>${escapeHtml(run.duration)}</span>
          </div>
          <p>${escapeHtml(run.summary)}</p>
          ${
            run.approvalStatus
              ? `<div class="approval-box">
                  <div>
                    <strong>${escapeHtml(run.purchaseStage ?? "구매 준비")}</strong>
                    <span>${escapeHtml(run.approvalStatus)}</span>
                  </div>
                  ${
                    run.approvalStatus === "승인 대기"
                      ? `<div class="approval-actions">
                          <button class="primary-button approve-run" data-run-id="${escapeHtml(run.id)}" type="button">구매 승인</button>
                          <button class="secondary-button reject-run" data-run-id="${escapeHtml(run.id)}" type="button">반려</button>
                        </div>`
                      : ""
                  }
                </div>`
              : ""
          }
          <details>
            <summary>Webhook payload 보기</summary>
            <pre>${escapeHtml(JSON.stringify(run.payload, null, 2))}</pre>
          </details>
        </article>
      `,
    )
    .join("");

  const empty = '<div class="mention-item"><strong>없음</strong><span>실행 로그 없음</span></div>';
  els.botRunList.innerHTML = html || empty;
  els.ideaRunList.innerHTML = html || empty;

  document.querySelectorAll(".approve-run").forEach((button) => {
    button.addEventListener("click", () => approvePurchaseRun(button.dataset.runId));
  });
  document.querySelectorAll(".reject-run").forEach((button) => {
    button.addEventListener("click", () => rejectPurchaseRun(button.dataset.runId));
  });
}

function renderFiles() {
  const files = currentProject().files;
  els.fileList.innerHTML = files
    .map(
      (file) => `
        <article class="file-row">
          <div class="file-icon">DOC</div>
          <div>
            <strong>${escapeHtml(file.name)}</strong>
            <span>${escapeHtml(file.source)} · ${escapeHtml(file.owner)} · ${escapeHtml(file.size)}</span>
          </div>
          <button class="secondary-button" type="button">열기</button>
        </article>
      `,
    )
    .join("");

  if (!files.length) {
    els.fileList.innerHTML = `
      <div class="empty-state">
        <h2>파일이 없습니다</h2>
        <p>파일을 추가하거나 봇을 실행하면 결과 파일이 여기에 표시됩니다.</p>
      </div>
    `;
  }
}

function countMentions(post) {
  const text = `${post.body} ${post.comments.map((comment) => comment.body).join(" ")}`;
  return (text.match(/@[가-힣A-Za-z0-9_]+/g) ?? []).length;
}

function renderAll() {
  renderProjects();
  renderMessages();
  renderPosts();
  renderSummary();
  renderBots();
  renderBotRuns();
  renderFiles();
}

function insertMention(handle) {
  const current = els.postBody.value;
  const needsSpace = current && !current.endsWith(" ");
  els.postBody.value = `${current}${needsSpace ? " " : ""}${handle} `;
  els.postBody.focus();
  hideMentionMenu();
}

function showMentionMenu() {
  els.mentionMenu.innerHTML = people
    .map(
      (person) => `
        <button type="button" class="mention-option" data-handle="${escapeHtml(person.handle)}">
          <span class="avatar">${escapeHtml(person.avatar)}</span>
          <span>
            <strong>${escapeHtml(person.handle)}</strong>
            <small>${escapeHtml(person.name)} · ${escapeHtml(person.team)}</small>
          </span>
        </button>
      `,
    )
    .join("");

  els.mentionMenu.classList.remove("hidden");
  els.mentionMenu.querySelectorAll(".mention-option").forEach((button) => {
    button.addEventListener("click", () => insertMention(button.dataset.handle));
  });
}

function hideMentionMenu() {
  els.mentionMenu.classList.add("hidden");
}

function addMessage(author, body, bot = false) {
  currentProject().messages.push({
    id: `msg-${Date.now()}`,
    author,
    body,
    createdAt: "Just now",
    bot,
  });
}

function buildBotPayload(bot, commandText) {
  const project = currentProject();
  const openPosts = project.posts.filter((post) => post.status !== "완료");
  const mentionedUsers = [...new Set(project.posts.flatMap((post) => {
    const text = `${post.body} ${post.comments.map((comment) => comment.body).join(" ")}`;
    return text.match(/@[가-힣A-Za-z0-9_]+/g) ?? [];
  }))];

  return {
    project: project.name,
    channel: project.channel,
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
      recordOrderResult: true,
    },
    vendorTargets: ["coupang", "gmarket"],
    mentions: mentionedUsers,
    posts: openPosts.map((post) => ({
      id: post.id,
      title: post.title,
      status: post.status,
      author: post.author,
    })),
  };
}

function completeBotRun(projectId, runId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  const run = project.botRuns.find((item) => item.id === runId);
  if (!run || run.status !== "실행중") return;

  const openPosts = project.posts.filter((post) => post.status !== "완료").length;
  run.status = "승인 대기";
  run.duration = "2.1s";
  run.purchaseStage = "장바구니 준비 완료";
  run.approvalStatus = "승인 대기";
  run.summary = `미완료 구매요청 ${openPosts}건을 정리했고 맥미니 구매봇이 결제 직전 단계까지 준비할 수 있습니다. 최종 결제는 담당자 승인이 필요합니다.`;

  project.messages.push({
    id: `msg-${Date.now()}`,
    author: `@${run.botName}`,
    body: `${run.command} 처리 준비 완료: ${run.summary}`,
    createdAt: "Just now",
    bot: true,
  });
  project.files.unshift({
    id: `file-${Date.now()}`,
    name: `${run.botName}-purchase-draft-${run.id}.md`,
    source: run.provider,
    owner: `@${run.botName}`,
    size: "8 KB",
  });
  saveState();
  renderAll();
}

function runBot(botId, commandText = "") {
  const project = currentProject();
  const bot = state.bots.find((item) => item.id === botId);
  if (!bot) return;

  const openPosts = project.posts.filter((post) => post.status !== "완료").length;
  const command = commandText || `${bot.command} 구매요청 요약`;
  const runId = `run-${Date.now()}`;
  const payload = buildBotPayload(bot, command);

  project.botRuns.unshift({
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
    payload,
  });
  addMessage("@시스템", `${bot.name} 실행을 시작했습니다: ${command}. 실제 결제는 승인 전까지 진행하지 않습니다.`, true);
  saveState();
  renderAll();

  window.setTimeout(() => completeBotRun(project.id, runId), 900);
}

function approvePurchaseRun(runId) {
  const project = currentProject();
  const run = project.botRuns.find((item) => item.id === runId);
  if (!run || run.approvalStatus !== "승인 대기") return;

  run.status = "승인됨";
  run.approvalStatus = "승인됨";
  run.purchaseStage = "구매 승인 완료";
  run.summary = "담당자가 구매를 승인했습니다. 맥미니 구매봇은 결제 화면에서 사람이 최종 결제를 진행한 뒤 주문번호를 기록해야 합니다.";
  run.payload.approvedBy = currentUser;
  run.payload.approvedAt = new Date().toISOString();
  run.payload.nextAction = "human_complete_payment_and_record_order";

  addMessage("@시스템", `${run.botName} 구매 초안이 승인되었습니다. 결제 화면에서 담당자가 최종 결제를 진행하세요.`, true);
  project.files.unshift({
    id: `file-${Date.now()}`,
    name: `${run.botName}-approval-${run.id}.md`,
    source: "구매 승인",
    owner: currentUser,
    size: "4 KB",
  });
  saveState();
  renderAll();
}

function rejectPurchaseRun(runId) {
  const project = currentProject();
  const run = project.botRuns.find((item) => item.id === runId);
  if (!run || run.approvalStatus !== "승인 대기") return;

  run.status = "반려";
  run.approvalStatus = "반려";
  run.purchaseStage = "구매 반려";
  run.summary = "담당자가 구매 초안을 반려했습니다. 구매요청 게시글을 수정한 뒤 다시 실행할 수 있습니다.";
  run.payload.rejectedBy = currentUser;
  run.payload.rejectedAt = new Date().toISOString();
  run.payload.nextAction = "revise_purchase_request";

  addMessage("@시스템", `${run.botName} 구매 초안이 반려되었습니다. 요청 내용을 수정한 뒤 다시 실행하세요.`, true);
  saveState();
  renderAll();
}

function handlePostSubmit(event) {
  event.preventDefault();

  const project = currentProject();
  const title = els.postTitle.value.trim();
  const body = els.postBody.value.trim();
  if (!title || !body) {
    els.postTitle.focus();
    return;
  }

  project.posts.unshift({
    id: `post-${Date.now()}`,
    title,
    body,
    status: els.postStatus.value,
    author: currentUser,
    createdAt: "Just now",
    link: extractLink(body),
    reactions: 0,
    comments: [],
  });

  addMessage(currentUser, `Ideas에 새 게시글을 등록했습니다: ${title}`);
  els.postForm.reset();
  saveState();
  renderAll();
}

function handleReplySubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.querySelector("input");
  const body = input.value.trim();
  if (!body) return;

  const project = currentProject();
  const post = project.posts.find((item) => item.id === form.dataset.postId);
  if (!post) return;

  post.comments.push({ id: `comment-${Date.now()}`, author: currentUser, body });
  addMessage(currentUser, `댓글을 남겼습니다: ${post.title}`);
  input.value = "";
  saveState();
  renderAll();
}

function handleStatusChange(event) {
  const project = currentProject();
  const post = project.posts.find((item) => item.id === event.target.dataset.postId);
  if (!post) return;

  post.status = event.target.value;
  addMessage("@시스템", `${post.title} 상태가 ${post.status}(으)로 변경되었습니다.`, true);
  saveState();
  renderAll();
}

function extractLink(value) {
  return value.split(/\s+/).find((part) => /^https?:\/\//.test(part)) ?? "";
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const selected = tab.dataset.tab;
    els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    Object.entries(els.views).forEach(([name, view]) => {
      view.classList.toggle("hidden", name !== selected);
    });
  });
});

els.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    els.filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderPosts();
  });
});

els.projectSelect.addEventListener("change", () => {
  state.selectedProjectId = els.projectSelect.value;
  activeFilter = "all";
  saveState();
  renderAll();
});

els.newProjectBtn.addEventListener("click", () => {
  els.newProjectName.value = "";
  els.projectDialog.showModal();
  els.newProjectName.focus();
});

els.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.newProjectName.value.trim();
  if (!name) return;

  const project = {
    id: `project-${Date.now()}`,
    name,
    channel: channelName,
    ...emptyProjectData(name),
  };

  state.projects.push(project);
  state.selectedProjectId = project.id;
  saveState();
  renderAll();
  els.projectDialog.close();
});

els.closeProjectDialog.addEventListener("click", () => {
  els.projectDialog.close();
});

els.postForm.addEventListener("submit", handlePostSubmit);
els.cancelPost.addEventListener("click", () => {
  els.postForm.reset();
  hideMentionMenu();
});

els.mentionBtn.addEventListener("click", showMentionMenu);
els.postBody.addEventListener("input", () => {
  const lastWord = els.postBody.value.split(/\s/).at(-1);
  if (lastWord?.startsWith("@")) {
    showMentionMenu();
  } else {
    hideMentionMenu();
  }
});

els.messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const body = els.messageInput.value.trim();
  if (!body) return;

  const matchedBot = state.bots.find((bot) => body.startsWith(bot.command));
  addMessage(currentUser, body);
  if (matchedBot) {
    runBot(matchedBot.id, body);
  } else {
    saveState();
    renderAll();
  }
  els.messageInput.value = "";
});

els.botForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.botName.value.trim();
  const command = els.botCommand.value.trim();
  const webhook = els.botWebhook.value.trim();
  if (!name || !command) return;

  state.bots.push({
    id: `bot-${Date.now()}`,
    name,
    provider: els.botProvider.value,
    command,
    webhook,
    enabled: true,
  });
  addMessage("@시스템", `${name} 봇이 ${command} 명령어로 연결되었습니다.`, true);
  els.botForm.reset();
  saveState();
  renderAll();
});

els.addFileBtn.addEventListener("click", () => {
  els.newFileName.value = "";
  els.newFileSource.value = "수동 추가";
  els.fileDialog.showModal();
  els.newFileName.focus();
});

els.fileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.newFileName.value.trim();
  const source = els.newFileSource.value.trim() || "수동 추가";
  if (!name) return;

  currentProject().files.unshift({
    id: `file-${Date.now()}`,
    name,
    source,
    owner: currentUser,
    size: "512 KB",
  });
  addMessage(currentUser, `파일을 추가했습니다: ${name}`);
  saveState();
  renderAll();
  els.fileDialog.close();
});

els.closeFileDialog.addEventListener("click", () => {
  els.fileDialog.close();
});

document.addEventListener("click", (event) => {
  if (!els.mentionMenu.contains(event.target) && event.target !== els.mentionBtn) {
    hideMentionMenu();
  }
});

renderAll();
