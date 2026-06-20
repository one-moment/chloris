// 통계(analytics) 모듈 매니페스트 (원모먼트 전용). 매출·광고·ROAS 대시보드 한 화면을 nav로 노출한다.
// 모듈 규칙: 모듈은 lib/(core·platform)만 import할 수 있고, 다른 모듈은 import할 수 없다
// (docs/platform-architecture.md 12절). 브랜드 게이팅은 lib/brand.js 의 ACTIVE_BRAND.modules 가
// 결정한다 (onemoment: [..., "analytics"]).
// minRole=admin: 매출·광고비는 재무 민감 정보라 일반 직원에게 숨긴다 (리더 결정 Q5).
export const analyticsModule = {
  slug: "analytics",
  name: "통계",
  nav: {
    label: "통계",
    href: "/work/analytics",
    minRole: "admin"
  }
};
