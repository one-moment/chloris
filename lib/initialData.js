export function makeMessage(body, author = "시스템", bot = false) {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author,
    body,
    createdAt: "방금 전",
    bot
  };
}

export function makePost({ title, body, author = "유경화", status = "검토중" }) {
  return {
    id: `post-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    body,
    author,
    status,
    createdAt: "방금 전",
    comments: []
  };
}

export function makeChannel(name, type = "general") {
  return {
    id: `channel-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    type,
    messages: [
      makeMessage(`${name} 채널이 생성되었습니다. Messages, Ideas, Files를 이 채널 안에서 함께 사용합니다.`, "채널봇", true)
    ],
    posts: [],
    files: [],
    botRuns: []
  };
}

const seedChannels = [
  {
    id: "manager-talk",
    name: "매니저 소통",
    type: "general",
    messages: [
      { id: "m-1", author: "정다은", body: "이번 주 매장별 이슈를 Ideas에 정리해두겠습니다.", createdAt: "오전 9:18", bot: false }
    ],
    posts: [
      {
        id: "p-1",
        title: "주간 매장 운영 체크",
        body: "오픈 준비, 위생 체크, 인력 공백 내용을 댓글로 남겨주세요. @captain 확인 부탁드립니다.",
        author: "정다은",
        status: "진행중",
        createdAt: "어제",
        comments: [{ id: "c-1", author: "captain", body: "오늘 오후까지 확인하겠습니다.", createdAt: "어제" }]
      }
    ],
    files: [{ id: "f-1", name: "weekly-store-check.xlsx", source: "수동 업로드", createdAt: "어제" }],
    botRuns: []
  },
  {
    id: "bakery",
    name: "베이커리",
    type: "general",
    messages: [
      { id: "m-2", author: "플라워팀", body: "베이커리 신메뉴 촬영 일정은 금요일 오전입니다.", createdAt: "오전 10:02", bot: false }
    ],
    posts: [],
    files: [],
    botRuns: []
  },
  {
    id: "purchase",
    name: "구매요청",
    type: "purchase",
    messages: [
      { id: "m-3", author: "구매봇", body: "구매요청 게시글을 기준으로 후보 상품을 찾고, 결제 직전에는 담당자 승인을 기다립니다.", createdAt: "오전 10:20", bot: true }
    ],
    posts: [
      {
        id: "p-2",
        title: "라벨 프린터 추가 구매",
        body: "쿠팡 또는 지마켓에서 라벨 프린터 1대와 라벨지 3롤을 찾아주세요. 예산은 25만원 이하입니다.",
        author: "유경화",
        status: "검토중",
        createdAt: "오늘",
        comments: []
      }
    ],
    files: [],
    botRuns: []
  },
  {
    id: "inbound",
    name: "입고 관리",
    type: "inbound",
    messages: [],
    posts: [
      {
        id: "p-3",
        title: "딸기 원물 입고",
        body: "공급처: 성원에프피아 / 품목: 딸기 / 수량: 8박스 / 입고일: 2026-05-28",
        author: "입고 담당자",
        status: "검토중",
        createdAt: "오늘",
        comments: []
      }
    ],
    files: [],
    botRuns: []
  },
  makeChannel("출고 관리", "outbound"),
  makeChannel("재고관리", "inventory")
];

export function createInitialState() {
  return {
    selectedProjectId: "onemoment",
    selectedChannelId: "manager-talk",
    projects: [
      {
        id: "onemoment",
        name: "onemoment",
        description: "회사 내부 커뮤니케이션 MVP",
        channels: seedChannels
      }
    ],
    bots: [
      { id: "summary", name: "채널 요약봇", provider: "Codex", command: "/summary", channelTypes: ["general", "purchase", "inbound", "outbound", "inventory"] },
      { id: "purchase-bot", name: "Codex 구매봇", provider: "Codex", command: "/purchase", channelTypes: ["purchase"] },
      { id: "inbound-sheet", name: "입고대장 업로드봇", provider: "Codex", command: "/inbound-sheet", channelTypes: ["inbound"] },
      { id: "outbound-sheet", name: "출고대장 업로드봇", provider: "Codex", command: "/outbound-sheet", channelTypes: ["outbound"] },
      { id: "inventory-sheet", name: "재고표 갱신봇", provider: "Claude Code", command: "/inventory-sync", channelTypes: ["inventory"] }
    ]
  };
}
