"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { History, Plus, RotateCcw, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

interface Version {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  user: { name: string };
}

interface VersionsPanelProps {
  documentId: string;
  onRestore: (json: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function VersionsPanel({ documentId, onRestore, disabled }: VersionsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");
  
  // Preview state
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null);
  const [previewJson, setPreviewJson] = useState<Record<string, unknown> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/documents/${documentId}/versions`);
      if (res.ok) {
        setVersions(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim()) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newVersionName.trim() }),
      });
      if (res.ok) {
        setNewVersionName("");
        fetchVersions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (version: Version) => {
    try {
      setPreviewVersion(version);
      setPreviewLoading(true);
      const res = await fetch(`/api/documents/${documentId}/versions/${version.id}/restore`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewJson(data.restoredJson);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmRestore = () => {
    if (previewJson) {
      onRestore(previewJson);
      setPreviewVersion(null);
      setPreviewJson(null);
      setIsOpen(false);
    }
  };

  const previewEditor = useEditor({
    editable: false,
    extensions: [StarterKit],
    content: previewJson,
  }, [previewJson]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <History className="h-4 w-4" />
        History
      </button>

      {/* Main Timeline Modal */}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white p-6 shadow-xl dark:bg-slate-900 overflow-y-auto h-full flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Version History</h2>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!disabled && (
              <form onSubmit={handleCreateSnapshot} className="mb-6 flex gap-2">
                <input
                  type="text"
                  placeholder="Snapshot name..."
                  value={newVersionName}
                  onChange={(e) => setNewVersionName(e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  disabled={saving || !newVersionName.trim()}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Save
                </button>
              </form>
            )}

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-center text-sm text-slate-500 mt-10">No versions saved yet.</p>
              ) : (
                <div className="space-y-4">
                  {versions.map((v) => (
                    <div key={v.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{v.name}</h3>
                        <span className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mb-4 text-xs text-slate-500">Saved by {v.user.name}</p>
                      
                      <button
                        onClick={() => handlePreview(v)}
                        className="w-full rounded-md bg-slate-100 py-2 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                      >
                        Preview
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      {mounted && previewVersion && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 lg:p-10">
          <div className="flex h-full w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold">Preview: {previewVersion.name}</h2>
                <p className="text-xs text-slate-500">
                  {new Date(previewVersion.createdAt).toLocaleString()} by {previewVersion.user.name}
                </p>
              </div>
              <button onClick={() => setPreviewVersion(null)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <EditorContent editor={previewEditor} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
              <button
                onClick={() => setPreviewVersion(null)}
                className="rounded-md px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              {!disabled && (
                <button
                  onClick={confirmRestore}
                  disabled={previewLoading}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore this version
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
