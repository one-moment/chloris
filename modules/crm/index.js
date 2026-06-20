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
  },
  // 액션형 멘션 컨트랙트 (@예약 v2 — docs/crm-reservation-mention.md 해법 A).
  // 코어 작성기(components/MentionInput.jsx)가 modules/registry.js 의 getMentionActions로
  // 이 데이터를 읽어 후보에 노출한다. 선택 시 텍스트 삽입 대신 hrefFor(channel) 딥링크로 위임.
  // 코어는 모듈을 import하지 않고 데이터(매니페스트)만 읽는다 — 에이전트-멘션 오픈 플랫폼 방향.
  mentionActions: [
    {
      token: "예약",
      label: "예약 등록",
      description: "이 지점방에서 새 예약을 등록합니다",
      minRole: "member",
      // branchId가 연결된 #지점방에서만 노출 (현장 직원은 지점 선택 불필요 — 채널 지점 자동).
      requiresBranch: true,
      hrefFor: (channel) =>
        `/work/reservations?new=1&channel=${encodeURIComponent(channel.id)}&branch=${encodeURIComponent(channel.branchId)}`
    }
  ]
};
