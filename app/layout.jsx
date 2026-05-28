import "./globals.css";

export const metadata = {
  title: "Mattermost Project MVP",
  description: "Project communication MVP with Ideas, Files, and automation bot approval flow"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
