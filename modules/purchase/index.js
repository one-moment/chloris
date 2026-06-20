// 구매 모듈 매니페스트 (Phase 1: nav만 선언, Phase 2에서 agents/chatCards/metrics 추가 예정)
export const purchaseModule = {
  slug: "purchase",
  name: "구매",
  nav: {
    label: "구매 관리",
    href: "/work/purchase",
    minRole: "member"
  }
};
