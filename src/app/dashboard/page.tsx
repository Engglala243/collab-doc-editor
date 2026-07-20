"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type Document = {
  id: string;
  title: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  memberCount: number;
  updatedAt: string;
  owner: { name: string; email: string };
};

const roleColors = {
  OWNER: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  EDITOR: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  VIEWER: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
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
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Documents</h1>
            <p className="text-neutral-400 text-sm mt-1">
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            id="new-doc-btn"
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Document
          </button>
        </div>

        {/* New Document Form */}
        {showNew && (
          <div className="mb-6 bg-neutral-900 border border-neutral-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-neutral-300 mb-3">New Document</h2>
            <form onSubmit={createDocument} className="flex gap-3">
              <input
                id="doc-title-input"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Document title..."
                autoFocus
                required
                className="flex-1 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition"
              />
              <button
                id="create-doc-btn"
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setShowNew(false); setNewTitle(""); }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </form>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
        )}

        {/* Documents List */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-neutral-900 border border-neutral-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-neutral-500 text-sm">No documents yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl p-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:shadow-black/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/documents/${doc.id}`}
                    id={`doc-${doc.id}`}
                    className="font-semibold text-white hover:text-violet-300 transition-colors line-clamp-2 flex-1"
                  >
                    {doc.title}
                  </Link>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${roleColors[doc.role]}`}>
                    {doc.role}
                  </span>
                </div>

                <div className="text-xs text-neutral-500 space-y-1">
                  <p>By {doc.owner.name}</p>
                  <p>Updated {new Date(doc.updatedAt).toLocaleDateString()}</p>
                  <p>{doc.memberCount} member{doc.memberCount !== 1 ? "s" : ""}</p>
                </div>

                <div className="flex gap-2 mt-auto pt-2 border-t border-neutral-800">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="flex-1 text-center text-xs py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
                  >
                    Open
                  </Link>
                  {doc.role === "OWNER" && (
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="text-xs py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
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
