import "./globals.css";
import { ACTIVE_BRAND, ACTIVE_BRAND_SLUG } from "../lib/brand";
import ServiceWorkerRegister from "../components/ServiceWorkerRegister";

export const metadata = {
  title: `${ACTIVE_BRAND.workspaceName} · Chloris`,
  description: "Chloris — 사내 Work OS. 채팅·게시판 기반에 회사별 업무 모듈을 더한 워크스페이스.",
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: "/icons/favicon-32.png"
  }
};

export const viewport = { themeColor: "#185640", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="ko" data-brand={ACTIVE_BRAND_SLUG}>
      <body>{children}<ServiceWorkerRegister /></body>
    </html>
  );
}
