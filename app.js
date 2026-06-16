const STORAGE_KEY = "mattermost-channel-mvp-v1";
const currentUser = "@박민수";

const people = [
  { handle: "@유경화", name: "유경화", team: "플라워팀", avatar: "유" },
  { handle: "@박민수", name: "박민수", team: "구매팀", avatar: "박" },
  { handle: "@디자인팀", name: "디자인팀", team: "Team", avatar: "디" },
  { handle: "@성원에프디아이", name: "성원에프디아이", team: "협력사", avatar: "성" },
];

const channelTypes = {
  general: {
    label: "일반 소통",
    description: "채팅과 Ideas 중심의 일반 소통 채널입니다. 자동화는 요약/할 일 추출 정도로 제한됩니다.",
  },
  purchase: {
    label: "구매요청",
    description: "구매요청을 정리하고 맥미니 구매봇이 장바구니/결제 직전 단계까지 준비합니다. 최종 결제는 담당자가 승인합니다.",
  },
  inbound: {
    label: "입고",
    description: "입고 게시글에서 품목, 수량, 거래처, 입고일을 추출해 연결된 스프레드시트 입고대장에 업로드합니다.",
  },
  outbound: {
    label: "출고",
    description: "출고 게시글에서 품목, 수량, 목적지, 담당자를 추출해 연결된 스프레드시트 출고대장에 업로드합니다.",
  },
  inventory: {
    label: "재고관리",
    description: "재고 변동 게시글을 분석해 재고표를 갱신하고 부족 재고 알림을 남깁니다.",
  },
};

const defaultBots = [
  { id: "bot-summary", name: "채널 요약봇", provider: "Codex", command: "/summary", channelTypes: ["general", "purchase", "inbound", "outbound", "inventory"] },
  { id: "bot-purchase", name: "Codex 구매봇", provider: "Codex", command: "/codex", channelTypes: ["purchase"] },
  { id: "bot-inbound", name: "입고대장 업로드봇", provider: "Custom Webhook", command: "/inbound", channelTypes: ["inbound"] },
  { id: "bot-outbound", name: "출고대장 업로드봇", provider: "Custom Webhook", command: "/outbound", channelTypes: ["outbound"] },
  { id: "bot-inventory", name: "재고표 갱신봇", provider: "Custom Webhook", command: "/inventory", channelTypes: ["inventory"] },
];

const samplePosts = [
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
      { id: "comment-2", author: "@유경화", body: "@박민수 금요일 오전까지 필요합니다." },
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
];

function makeChannel(name, type, seed = false) {
  return {
    id: `channel-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    type,
    messages: seed
      ? [
          { id: "msg-1", author: "@유경화", body: "베이커리 포장재 구매요청을 Ideas에 등록했습니다.", createdAt: "May 21 at 1:26 PM", bot: false },
          { id: "msg-2", author: "@Codex 구매봇", body: "구매요청 2건을 확인했습니다.", createdAt: "Today at 9:55 AM", bot: true },
        ]
      : [{ id: `msg-${Date.now()}`, author: "@시스템", body: `${name} 채널이 생성되었습니다.`, createdAt: "Just now", bot: true }],
    posts: seed ? structuredClone(samplePosts) : [],
    files: seed
      ? [
          { id: "file-1", name: "shopping-bag-sample.pdf", source: "Ideas 첨부", owner: "@박민수", size: "1.8 MB" },
          { id: "file-2", name: "purchase-summary.md", source: "Codex 구매봇", owner: "@Codex 구매봇", size: "24 KB" },
        ]
      : [],
    botRuns: [],
  };
}

function defaultState() {
  const purchase = makeChannel("구매요청", "purchase", true);
  return {
    selectedProjectId: "project-1",
    selectedChannelId: purchase.id,
    projects: [
      {
        id: "project-1",
        name: "onemoment",
        channels: [
          makeChannel("매니저 소통", "general"),
          makeChannel("베이커리", "general"),
          purchase,
          makeChannel("입고 관리", "inbound"),
          makeChannel("출고 관리", "outbound"),
          makeChannel("재고관리", "inventory"),
        ],
      },
    ],
    bots: structuredClone(defaultBots),
  };
}

let state = loadState();
let activeFilter = "all";

const els = {
  projectSelect: document.querySelector("#projectSelect"),
  newProjectBtn: document.querySelector("#newProjectBtn"),
  projectDialog: document.querySelector("#projectDialog"),
  projectForm: document.querySelector("#projectForm"),
  closeProjectDialog: document.querySelector("#closeProjectDialog"),
  newProjectName: document.querySelector("#newProjectName"),
  newChannelBtn: document.querySelector("#newChannelBtn"),
  channelDialog: document.querySelector("#channelDialog"),
  channelForm: document.querySelector("#channelForm"),
  closeChannelDialog: document.querySelector("#closeChannelDialog"),
  newChannelName: document.querySelector("#newChannelName"),
  newChannelType: document.querySelector("#newChannelType"),
  fileDialog: document.querySelector("#fileDialog"),
  fileForm: document.querySelector("#fileForm"),
  closeFileDialog: document.querySelector("#closeFileDialog"),
  newFileName: document.querySelector("#newFileName"),
  newFileSource: document.querySelector("#newFileSource"),
  channelTitle: document.querySelector("#channelTitle"),
  channelList: document.querySelector("#channelList"),
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
  automationPanelTitle: document.querySelector("#automationPanelTitle"),
  automationPanelDescription: document.querySelector("#automationPanelDescription"),
  postForm: document.querySelector("#postForm"),
  postTitle: document.querySelector("#postTitle"),
  postBody: document.querySelector("#postBody"),
  postStatus: document.querySelector("#postStatus"),
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

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultState();
  try {
    const parsed = JSON.parse(saved);
    if (!parsed.projects?.[0]?.channels) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentProject() {
  return state.projects.find((project) => project.id === state.selectedProjectId) ?? state.projects[0];
}

function currentChannel() {
  const project = currentProject();
  return project.channels.find((channel) => channel.id === state.selectedChannelId) ?? project.channels[0];
}

function availableBots(channel = currentChannel()) {
  return state.bots.filter((bot) => bot.channelTypes?.includes(channel.type));
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
  return escapeHtml(value).replace(/(@[가-힣A-Za-z0-9_]+)/g, '<span class="mention">$1</span>');
}

function initials(handle) {
  const person = people.find((item) => item.handle === handle);
  return person?.avatar ?? handle.replace("@", "").slice(0, 1).toUpperCase();
}

function statusTone(status) {
  if (["성공", "승인됨", "완료"].includes(status)) return "chip";
  if (["실행중", "진행중"].includes(status)) return "chip blue";
  if (["실패", "반려"].includes(status)) return "chip danger";
  return "chip amber";
}

function renderProjects() {
  const project = currentProject();
  els.projectSelect.innerHTML = state.projects
    .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === project.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
}

function renderChannels() {
  const channel = currentChannel();
  els.channelTitle.textContent = channel.name;
  els.channelList.innerHTML = currentProject().channels
    .map((item) => {
      const openCount = item.posts.filter((post) => post.status !== "완료").length;
      return `
        <button class="channel-item ${item.id === channel.id ? "active" : "muted"}" data-channel-id="${escapeHtml(item.id)}">
          <span>${escapeHtml(item.name)} <small class="channel-type">${escapeHtml(channelTypes[item.type]?.label ?? item.type)}</small></span>
          ${openCount ? `<b>${openCount}</b>` : ""}
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-channel-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedChannelId = button.dataset.channelId;
      activeFilter = "all";
      saveState();
      renderAll();
    });
  });
}

function renderMessages() {
  const channel = currentChannel();
  els.messageList.innerHTML = channel.messages
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

function filteredPosts() {
  const posts = currentChannel().posts;
  if (activeFilter === "mentions") return posts.filter((post) => post.body.includes(currentUser) || post.comments.some((comment) => comment.body.includes(currentUser)));
  if (activeFilter === "open") return posts.filter((post) => post.status !== "완료");
  return posts;
}

function renderPosts() {
  const posts = filteredPosts();
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
                  ${["검토중", "진행중", "완료"].map((status) => `<option value="${status}" ${status === post.status ? "selected" : ""}>${status}</option>`).join("")}
                </select>
              </div>
              <div class="post-meta">${escapeHtml(post.author)} · ${escapeHtml(post.createdAt)}</div>
            </div>
            <div class="post-actions"><button class="icon-button">↗</button><button class="icon-button">♡</button></div>
          </div>
          <div class="post-body">${renderMentionedText(post.body)}</div>
          ${post.link ? `<div class="link-preview"><div><strong>첨부 링크</strong><span>${escapeHtml(post.link)}</span></div><button class="secondary-button">열기</button></div>` : ""}
          <div class="post-footer"><span>좋아요 ${post.reactions}</span><span>댓글 ${post.comments.length}</span><span>멘션 ${countMentions(post)}</span></div>
          <section class="comments" aria-label="댓글">
            ${post.comments.map((comment) => `<div class="comment"><div class="avatar">${escapeHtml(initials(comment.author))}</div><div class="comment-body"><strong>${escapeHtml(comment.author)}</strong>${renderMentionedText(comment.body)}</div></div>`).join("")}
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
    els.postList.innerHTML = `<div class="empty-state"><h2>표시할 게시글이 없습니다</h2><p>현재 채널에 새 Ideas 게시글을 작성해보세요.</p></div>`;
  }

  document.querySelectorAll(".reply-form").forEach((form) => form.addEventListener("submit", handleReplySubmit));
  document.querySelectorAll(".status-select").forEach((select) => select.addEventListener("change", handleStatusChange));
}

function renderSummary() {
  const posts = currentChannel().posts;
  els.reviewCount.textContent = posts.filter((post) => post.status === "검토중").length;
  els.progressCount.textContent = posts.filter((post) => post.status === "진행중").length;
  els.doneCount.textContent = posts.filter((post) => post.status === "완료").length;
  const mentions = posts.filter((post) => post.body.includes(currentUser)).slice(0, 3);
  els.mentionList.innerHTML = mentions.length
    ? mentions.map((post) => `<div class="mention-item"><strong>${escapeHtml(post.title)}</strong><span>${escapeHtml(post.status)}</span></div>`).join("")
    : '<div class="mention-item"><strong>없음</strong><span>새 멘션 없음</span></div>';
}

function botCardHtml(bot) {
  return `
    <div class="bot-card">
      <div><strong>${escapeHtml(bot.name)}</strong><span>${escapeHtml(bot.provider)} · ${escapeHtml(bot.command)}</span></div>
      <button class="secondary-button run-bot" data-bot-id="${escapeHtml(bot.id)}" type="button">실행</button>
    </div>
  `;
}

function renderBots() {
  const channel = currentChannel();
  const type = channelTypes[channel.type] ?? channelTypes.general;
  els.automationPanelTitle.textContent = `${type.label} 자동화`;
  els.automationPanelDescription.textContent = type.description;
  const botCards = availableBots(channel).map(botCardHtml).join("");
  els.botList.innerHTML = botCards || '<div class="mention-item"><strong>없음</strong><span>연결된 봇 없음</span></div>';
  els.ideaBotActions.innerHTML = botCards || '<div class="mention-item"><strong>없음</strong><span>이 채널에는 자동화봇이 없습니다</span></div>';
  document.querySelectorAll(".run-bot").forEach((button) => button.addEventListener("click", () => runBot(button.dataset.botId)));
}

function approvalHtml(run) {
  return `
    <div class="approval-box">
      <div><strong>${escapeHtml(run.purchaseStage ?? "자동화 준비")}</strong><span>${escapeHtml(run.approvalStatus)}</span></div>
      ${
        run.approvalStatus === "승인 대기"
          ? `<div class="approval-actions"><button class="primary-button approve-run" data-run-id="${escapeHtml(run.id)}" type="button">승인</button><button class="secondary-button reject-run" data-run-id="${escapeHtml(run.id)}" type="button">반려</button></div>`
          : ""
      }
    </div>
  `;
}

function renderBotRuns() {
  const runs = currentChannel().botRuns;
  const html = runs
    .slice(0, 6)
    .map(
      (run) => `
        <article class="run-card">
          <div class="run-head"><div><strong>${escapeHtml(run.botName)}</strong><span>${escapeHtml(run.command)}</span></div><span class="${statusTone(run.status)}">${escapeHtml(run.status)}</span></div>
          <div class="run-meta"><span>${escapeHtml(run.requestedBy)}</span><span>${escapeHtml(run.createdAt)}</span><span>${escapeHtml(run.duration)}</span></div>
          <p>${escapeHtml(run.summary)}</p>
          ${run.approvalStatus ? approvalHtml(run) : ""}
          <details><summary>Webhook payload 보기</summary><pre>${escapeHtml(JSON.stringify(run.payload, null, 2))}</pre></details>
        </article>
      `,
    )
    .join("");
  const empty = '<div class="mention-item"><strong>없음</strong><span>실행 로그 없음</span></div>';
  els.botRunList.innerHTML = html || empty;
  els.ideaRunList.innerHTML = html || empty;
  document.querySelectorAll(".approve-run").forEach((button) => button.addEventListener("click", () => approveRun(button.dataset.runId)));
  document.querySelectorAll(".reject-run").forEach((button) => button.addEventListener("click", () => rejectRun(button.dataset.runId)));
}

function renderFiles() {
  const files = currentChannel().files;
  els.fileList.innerHTML = files
    .map((file) => `<article class="file-row"><div class="file-icon">DOC</div><div><strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.source)} · ${escapeHtml(file.owner)} · ${escapeHtml(file.size)}</span></div><button class="secondary-button">열기</button></article>`)
    .join("");
  if (!files.length) els.fileList.innerHTML = `<div class="empty-state"><h2>파일이 없습니다</h2><p>파일을 추가하거나 봇을 실행하면 결과 파일이 여기에 표시됩니다.</p></div>`;
}

function renderAll() {
  renderProjects();
  renderChannels();
  renderMessages();
  renderPosts();
  renderSummary();
  renderBots();
  renderBotRuns();
  renderFiles();
}

function addMessage(author, body, bot = false) {
  currentChannel().messages.push({ id: `msg-${Date.now()}`, author, body, createdAt: "Just now", bot });
}

function buildPayload(bot, commandText) {
  const channel = currentChannel();
  const openPosts = channel.posts.filter((post) => post.status !== "완료");
  const payload = {
    project: currentProject().name,
    channel: channel.name,
    channelType: channel.type,
    provider: bot.provider,
    bot: bot.name,
    command: commandText || bot.command,
    requester: currentUser,
    openPosts: openPosts.length,
    posts: openPosts.map((post) => ({ id: post.id, title: post.title, status: post.status, author: post.author })),
  };
  if (channel.type === "purchase") {
    payload.approvalRequired = true;
    payload.finalPaymentMode = "human_approval_required";
    payload.buyerBotHost = "mac-mini-purchase-bot";
    payload.browserAutomation = { mode: "remote_browser_control", allowedUntil: "checkout_review", stopBeforePayment: true };
    payload.vendorTargets = ["coupang", "gmarket"];
  }
  if (["inbound", "outbound", "inventory"].includes(channel.type)) {
    payload.sheetSync = {
      target: channel.type === "inbound" ? "입고대장" : channel.type === "outbound" ? "출고대장" : "재고표",
      mode: "append_or_update",
      approvalRequired: false,
    };
  }
  return payload;
}

function runBot(botId, commandText = "") {
  const channel = currentChannel();
  const bot = state.bots.find((item) => item.id === botId);
  if (!bot) return;
  const command = commandText || `${bot.command} ${channel.name} 처리`;
  const runId = `run-${Date.now()}`;
  const isPurchase = channel.type === "purchase";
  const isSheet = ["inbound", "outbound", "inventory"].includes(channel.type);
  channel.botRuns.unshift({
    id: runId,
    botId: bot.id,
    botName: bot.name,
    provider: bot.provider,
    command,
    status: "실행중",
    requestedBy: currentUser,
    createdAt: "Just now",
    duration: "진행중",
    summary: isPurchase ? "맥미니 구매봇 Webhook 호출 대기 중입니다. 실제 결제는 승인 전까지 진행하지 않습니다." : isSheet ? "스프레드시트 자동화 Webhook 호출 대기 중입니다." : "채널 내용을 요약하고 할 일을 정리합니다.",
    purchaseStage: isPurchase ? "요청 접수" : undefined,
    approvalStatus: isPurchase ? "준비 중" : undefined,
    payload: buildPayload(bot, command),
  });
  addMessage("@시스템", `${bot.name} 실행을 시작했습니다: ${command}`, true);
  saveState();
  renderAll();
  window.setTimeout(() => completeRun(channel.id, runId), 900);
}

function completeRun(channelId, runId) {
  const channel = currentProject().channels.find((item) => item.id === channelId);
  if (!channel) return;
  const run = channel.botRuns.find((item) => item.id === runId);
  if (!run || run.status !== "실행중") return;
  if (channel.type === "purchase") {
    run.status = "승인 대기";
    run.purchaseStage = "장바구니 준비 완료";
    run.approvalStatus = "승인 대기";
    run.summary = "구매요청을 정리했고 맥미니 구매봇이 결제 직전 단계까지 준비할 수 있습니다. 최종 결제는 담당자 승인이 필요합니다.";
    channel.files.unshift({ id: `file-${Date.now()}`, name: `${run.botName}-purchase-draft-${run.id}.md`, source: run.provider, owner: `@${run.botName}`, size: "8 KB" });
  } else if (["inbound", "outbound", "inventory"].includes(channel.type)) {
    run.status = "성공";
    run.summary = `${channelTypes[channel.type].label} 내용을 연결된 스프레드시트에 업로드했습니다.`;
    channel.files.unshift({ id: `file-${Date.now()}`, name: `${channel.name}-sheet-sync-${run.id}.md`, source: "스프레드시트 자동화", owner: `@${run.botName}`, size: "6 KB" });
  } else {
    run.status = "성공";
    run.summary = "채널 내용을 요약하고 후속 할 일을 정리했습니다.";
  }
  run.duration = "2.1s";
  channel.messages.push({ id: `msg-${Date.now()}`, author: `@${run.botName}`, body: `${run.command} 처리 결과: ${run.summary}`, createdAt: "Just now", bot: true });
  saveState();
  renderAll();
}

function approveRun(runId) {
  const channel = currentChannel();
  const run = channel.botRuns.find((item) => item.id === runId);
  if (!run || run.approvalStatus !== "승인 대기") return;
  run.status = "승인됨";
  run.approvalStatus = "승인됨";
  run.purchaseStage = "구매 승인 완료";
  run.summary = "담당자가 구매를 승인했습니다. 최종 결제는 사람이 진행하고 주문번호를 기록합니다.";
  run.payload.approvedBy = currentUser;
  run.payload.nextAction = "human_complete_payment_and_record_order";
  addMessage("@시스템", `${run.botName} 구매 초안이 승인되었습니다. 결제 화면에서 담당자가 최종 결제를 진행하세요.`, true);
  channel.files.unshift({ id: `file-${Date.now()}`, name: `${run.botName}-approval-${run.id}.md`, source: "구매 승인", owner: currentUser, size: "4 KB" });
  saveState();
  renderAll();
}

function rejectRun(runId) {
  const channel = currentChannel();
  const run = channel.botRuns.find((item) => item.id === runId);
  if (!run || run.approvalStatus !== "승인 대기") return;
  run.status = "반려";
  run.approvalStatus = "반려";
  run.purchaseStage = "구매 반려";
  run.summary = "담당자가 구매 초안을 반려했습니다. 게시글을 수정한 뒤 다시 실행할 수 있습니다.";
  run.payload.rejectedBy = currentUser;
  run.payload.nextAction = "revise_purchase_request";
  addMessage("@시스템", `${run.botName} 구매 초안이 반려되었습니다.`, true);
  saveState();
  renderAll();
}

function countMentions(post) {
  const text = `${post.body} ${post.comments.map((comment) => comment.body).join(" ")}`;
  return (text.match(/@[가-힣A-Za-z0-9_]+/g) ?? []).length;
}

function handlePostSubmit(event) {
  event.preventDefault();
  const title = els.postTitle.value.trim();
  const body = els.postBody.value.trim();
  if (!title || !body) return;
  currentChannel().posts.unshift({ id: `post-${Date.now()}`, title, body, status: els.postStatus.value, author: currentUser, createdAt: "Just now", link: body.split(/\s+/).find((part) => /^https?:\/\//.test(part)) ?? "", reactions: 0, comments: [] });
  addMessage(currentUser, `Ideas에 새 게시글을 등록했습니다: ${title}`);
  els.postForm.reset();
  saveState();
  renderAll();
}

function handleReplySubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = form.querySelector("input").value.trim();
  if (!body) return;
  const post = currentChannel().posts.find((item) => item.id === form.dataset.postId);
  if (!post) return;
  post.comments.push({ id: `comment-${Date.now()}`, author: currentUser, body });
  addMessage(currentUser, `댓글을 남겼습니다: ${post.title}`);
  saveState();
  renderAll();
}

function handleStatusChange(event) {
  const post = currentChannel().posts.find((item) => item.id === event.target.dataset.postId);
  if (!post) return;
  post.status = event.target.value;
  addMessage("@시스템", `${post.title} 상태가 ${post.status}(으)로 변경되었습니다.`, true);
  saveState();
  renderAll();
}

els.tabs.forEach((tab) => tab.addEventListener("click", () => {
  const selected = tab.dataset.tab;
  els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
  Object.entries(els.views).forEach(([name, view]) => view.classList.toggle("hidden", name !== selected));
}));

els.filterButtons.forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  els.filterButtons.forEach((item) => item.classList.toggle("active", item === button));
  renderPosts();
}));

els.projectSelect.addEventListener("change", () => {
  state.selectedProjectId = els.projectSelect.value;
  state.selectedChannelId = currentProject().channels[0].id;
  saveState();
  renderAll();
});

els.newProjectBtn.addEventListener("click", () => {
  els.newProjectName.value = "";
  els.projectDialog.showModal();
});

els.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.newProjectName.value.trim();
  if (!name) return;
  const defaultChannel = makeChannel("매니저 소통", "general");
  state.projects.push({ id: `project-${Date.now()}`, name, channels: [defaultChannel] });
  state.selectedProjectId = state.projects.at(-1).id;
  state.selectedChannelId = defaultChannel.id;
  saveState();
  els.projectDialog.close();
  renderAll();
});

els.closeProjectDialog.addEventListener("click", () => els.projectDialog.close());

els.newChannelBtn.addEventListener("click", () => {
  els.newChannelName.value = "";
  els.newChannelType.value = "general";
  els.channelDialog.showModal();
});

els.channelForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.newChannelName.value.trim();
  if (!name) return;
  const channel = makeChannel(name, els.newChannelType.value);
  currentProject().channels.push(channel);
  state.selectedChannelId = channel.id;
  saveState();
  els.channelDialog.close();
  renderAll();
});

els.closeChannelDialog.addEventListener("click", () => els.channelDialog.close());
els.postForm.addEventListener("submit", handlePostSubmit);
els.cancelPost.addEventListener("click", () => els.postForm.reset());

els.messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const body = els.messageInput.value.trim();
  if (!body) return;
  const bot = availableBots().find((item) => body.startsWith(item.command));
  addMessage(currentUser, body);
  els.messageInput.value = "";
  if (bot) runBot(bot.id, body);
  else {
    saveState();
    renderAll();
  }
});

els.botForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.botName.value.trim();
  const command = els.botCommand.value.trim();
  if (!name || !command) return;
  state.bots.push({ id: `bot-${Date.now()}`, name, provider: els.botProvider.value, command, webhook: els.botWebhook.value.trim(), channelTypes: [currentChannel().type] });
  addMessage("@시스템", `${name} 봇이 현재 채널에 연결되었습니다.`, true);
  els.botForm.reset();
  saveState();
  renderAll();
});

els.addFileBtn.addEventListener("click", () => {
  els.newFileName.value = "";
  els.newFileSource.value = "수동 추가";
  els.fileDialog.showModal();
});

els.fileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.newFileName.value.trim();
  if (!name) return;
  currentChannel().files.unshift({ id: `file-${Date.now()}`, name, source: els.newFileSource.value.trim() || "수동 추가", owner: currentUser, size: "512 KB" });
  addMessage(currentUser, `파일을 추가했습니다: ${name}`);
  saveState();
  els.fileDialog.close();
  renderAll();
});

els.closeFileDialog.addEventListener("click", () => els.fileDialog.close());

renderAll();
