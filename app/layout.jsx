/* eslint-disable @next/next/no-page-custom-font -- App Router 루트 레이아웃은 폰트를 전역 로드함 */
import "./globals.css";

export const metadata = {
  title: "오늘꽃 · 사입 파트너",
  description:
    "검증된 사장님만 받는 회원제 B2B 화훼 도매 솔루션 — 실시간 시세, 눈으로 보는 검수, 사입 명세서."
};

export const viewport = {
  themeColor: "#1b4a3c"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
