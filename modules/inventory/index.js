// Inventory module manifest (보로플라워마켓 전용). 폐기/입고 두 화면을 각각 nav로 노출한다.
// 모듈 규칙: 모듈은 lib/(core·platform)만 import할 수 있고, 다른 모듈은 import할 수 없다
// (docs/platform-architecture.md 12절). 브랜드 게이팅은 lib/brand.js 의 ACTIVE_BRAND.modules 가
// 결정한다 (borough: [..., "disposal", "stockin"]). 설계: docs/inventory-stockin-disposal.md
export const disposalModule = {
  slug: "disposal",
  name: "폐기관리",
  nav: {
    label: "폐기 관리",
    href: "/work/disposal",
    minRole: "member"
  }
};

export const stockInModule = {
  slug: "stockin",
  name: "입고관리",
  nav: {
    label: "입고 관리",
    href: "/work/stock-in",
    minRole: "member"
  }
};

// 품목·폐기원인 마스터 + 신규 품목 요청 승인 화면 (관리자 전용 nav).
export const inventoryMasterModule = {
  slug: "inventory-master",
  name: "재고 마스터",
  nav: {
    label: "재고 마스터",
    href: "/work/inventory/masters",
    minRole: "admin"
  }
};
