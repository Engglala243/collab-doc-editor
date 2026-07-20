"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { RiAddLine, RiFileList3Line } from "react-icons/ri";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

type Document = {
  id: string;
  title: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  memberCount: number;
  updatedAt: string;
  owner: { name: string; email: string };
};

const roleColors = {
  OWNER: "bg-[#e60000]/10 text-[#e60000] border-[#e60000]/20",
  EDITOR: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  VIEWER: "bg-[#262626] text-[#a1a1aa] border-[#404040]",
};

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  async function fetchDocuments() {
    const res = await fetch("/api/documents");
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents);
    }
    setLoading(false);
  }

  async function createDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setError("");

    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      setDocuments((prev) => [{ ...data.document, memberCount: 1 }, ...prev]);
      setNewTitle("");
      setShowNew(false);
    } else {
      setError("Failed to create document");
    }
    setCreating(false);
  }

  async function deleteDocument(id: string) {
    if (!confirm("Delete this document?")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDocuments();
  }, []);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-bold text-white tracking-tight">My Documents</h1>
            <p className="text-[#a1a1aa] text-[15px] mt-1">
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            id="new-doc-btn"
            onClick={() => setShowNew(true)}
          >
            <RiAddLine className="w-5 h-5" />
            New Document
          </Button>
        </div>

        {showNew && (
          <Card className="mb-8 p-6">
            <h2 className="text-[15px] font-semibold text-[#e5e5e5] mb-4">New Document</h2>
            <form onSubmit={createDocument} className="flex gap-3">
              <Input
                id="doc-title-input"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Document title..."
                autoFocus
                required
                className="flex-1"
              />
              <Button
                id="create-doc-btn"
                type="submit"
                disabled={creating}
              >
                {creating ? "Creating..." : "Create"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setShowNew(false); setNewTitle(""); }}
              >
                Cancel
              </Button>
            </form>
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          </Card>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-[#171717] border border-[#262626] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-24 bg-[#171717] border border-[#262626] rounded-3xl">
            <div className="w-16 h-16 rounded-2xl bg-[#262626] border border-[#404040]/50 flex items-center justify-center mx-auto mb-5">
              <RiFileList3Line className="w-8 h-8 text-[#737373]" />
            </div>
            <p className="text-[#a1a1aa] text-[15px]">No documents yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group bg-[#171717] border border-[#262626] hover:border-[#404040] rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-xl shadow-black/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/documents/${doc.id}`}
                    id={`doc-${doc.id}`}
                    className="font-bold text-[18px] text-white hover:text-[#ff4d4d] transition-colors line-clamp-2 flex-1 tracking-tight"
                  >
                    {doc.title}
                  </Link>
                  <span className={`shrink-0 text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-md border font-bold ${roleColors[doc.role]}`}>
                    {doc.role}
                  </span>
                </div>

                <div className="text-[13px] text-[#a1a1aa] space-y-1.5">
                  <p>By <span className="text-[#e5e5e5]">{doc.owner.name}</span></p>
                  <p>Updated {new Date(doc.updatedAt).toLocaleDateString()}</p>
                  <p>{doc.memberCount} member{doc.memberCount !== 1 ? "s" : ""}</p>
                </div>

                <div className="flex gap-2 mt-auto pt-4 border-t border-[#262626]">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="flex-1 text-center text-[14px] font-medium py-2 bg-[#262626] hover:bg-[#333333] text-[#e5e5e5] rounded-xl transition-colors border border-[#404040]/50"
                  >
                    Open
                  </Link>
                  {doc.role === "OWNER" && (
                    <Button
                      variant="danger"
                      onClick={() => deleteDocument(doc.id)}
                      className="px-4 py-2"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
