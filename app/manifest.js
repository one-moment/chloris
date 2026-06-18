// 회사별 테마 스왑을 위해 brands 맵 + NEXT_PUBLIC_BRAND(기본 borough)로 선택.
// (추후 단일 출처 lib/constants.js 이전 방향 유지, 이번 단계는 하드코딩)
const brands = {
  borough: {
    name: "보로플라워마켓 워크스페이스",
    short_name: "보로",
    description: "보로플라워마켓 매장 업무 워크스페이스",
    theme_color: "#185640",
    background_color: "#F7F4EA",
  },
};

export default function manifest() {
  const brand = brands[process.env.NEXT_PUBLIC_BRAND] ?? brands.borough;
  return {
    name: brand.name,
    short_name: brand.short_name,
    description: brand.description,
    start_url: "/",
    display: "standalone",
    theme_color: brand.theme_color,
    background_color: brand.background_color,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
