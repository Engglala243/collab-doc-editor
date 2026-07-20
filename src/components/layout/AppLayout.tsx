"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { ReactNode } from "react";
import { RiFileList3Fill, RiGithubFill, RiLinkedinFill } from "react-icons/ri";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e60000] group-hover:bg-[#cc0000] transition-colors">
              <RiFileList3Fill className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-[18px] text-white tracking-tight group-hover:text-[#e5e5e5] transition-colors">
              CollabDocs
            </span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-[15px] font-medium text-[#a1a1aa] transition-colors hover:text-[#ff4d4d]"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Main Content — flex-1 pushes footer to the bottom */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#262626] bg-[#0a0a0a] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <p className="text-[14px] text-[#a1a1aa]">
            Built by <span className="font-semibold text-[#e5e5e5]">Aditya Patidar</span>
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/Engglala243"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[14px] font-medium text-[#a1a1aa] transition-colors hover:text-[#e5e5e5]"
            >
              <RiGithubFill className="h-5 w-5" />
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/aditya-patidar-9349a3218/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[14px] font-medium text-[#a1a1aa] transition-colors hover:text-[#e5e5e5]"
            >
              <RiLinkedinFill className="h-5 w-5" />
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
