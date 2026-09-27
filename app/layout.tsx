import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Next.js Docs RAG Chatbot",
  description: "A small RAG chatbot over Next.js App Router docs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
