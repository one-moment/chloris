// CRM 모듈 매니페스트 (보로플라워마켓 전용). 고객/예약 두 화면을 각각 nav로 노출한다.
// 모듈 규칙: 모듈은 lib/(core·platform)만 import할 수 있고, 다른 모듈은 import할 수 없다
// (docs/platform-architecture.md 12절). 브랜드 게이팅은 lib/brand.js 의
// ACTIVE_BRAND.modules 가 결정한다 (borough: ["purchase","crm","reservations"]).
export const crmModule = {
  slug: "crm",
  name: "고객관리",
  nav: {
    label: "고객 관리",
    href: "/work/customers",
    minRole: "member"
  }
};

export const reservationsModule = {
  slug: "reservations",
  name: "예약관리",
  nav: {
    label: "예약 관리",
    href: "/work/reservations",
    minRole: "member"
  }
};
