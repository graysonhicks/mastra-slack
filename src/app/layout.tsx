import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slack + Mastra Demo",
  description: "Create Slack apps powered by Mastra agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

