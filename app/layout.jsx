import "./globals.css";
import ServiceWorkerRegister from "../components/ServiceWorkerRegister";

export const metadata = {
  title: "클로리스 | 보로플라워마켓",
  description: "Project communication MVP with Ideas, Files, and automation bot approval flow",
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: "/icons/favicon-32.png"
  }
};

export const viewport = { themeColor: "#185640", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}<ServiceWorkerRegister /></body>
    </html>
  );
}
