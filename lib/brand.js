// Per-company brand configuration for the shared Chloris core.
// One codebase → multiple Vercel projects, each setting NEXT_PUBLIC_BRAND.
// Differences per company: display name, theme, and which work modules are enabled.
// CRM/reservations are Borough-only custom modules; purchase is shared.

export const BRANDS = {
  onemoment: {
    slug: "onemoment",
    name: "원모먼트",
    workspaceName: "원모먼트 워크스페이스",
    logo: "/brand/onemoment/logo-mark.svg",
    modules: ["purchase", "analytics"]
  },
  borough: {
    slug: "borough",
    name: "보로플라워마켓",
    workspaceName: "보로 워크스페이스",
    logo: "/brand/logo-mark-gold.png",
    modules: ["purchase", "crm", "reservations", "disposal", "stockin", "inventory-master", "inventory-insights"]
  },
  todaykkot: {
    slug: "todaykkot",
    name: "오늘꽃",
    workspaceName: "오늘꽃 워크스페이스",
    logo: "/brand/logo-mark-gold.png",
    modules: ["purchase"]
  }
};

// Current production is the Borough instance, so Borough is the default until
// the per-company Vercel projects set NEXT_PUBLIC_BRAND explicitly.
export const DEFAULT_BRAND = "borough";

export const ACTIVE_BRAND_SLUG = BRANDS[process.env.NEXT_PUBLIC_BRAND]
  ? process.env.NEXT_PUBLIC_BRAND
  : DEFAULT_BRAND;

export const ACTIVE_BRAND = BRANDS[ACTIVE_BRAND_SLUG];

export function isModuleEnabled(slug) {
  return ACTIVE_BRAND.modules.includes(slug);
}
