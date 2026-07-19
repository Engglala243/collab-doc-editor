import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CollabDocs — Collaborative Document Editor",
  description: "Offline-first collaborative document editor with real-time sync",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-neutral-950 text-neutral-50 antialiased`}>
        {children}
      </body>
    </html>
  );
}
