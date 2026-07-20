"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { RiHistoryLine, RiAddLine, RiRestartLine, RiCloseLine, RiLoader4Line } from "react-icons/ri";
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
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none text-[#e5e5e5]",
      },
    },
  }, [previewJson]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-xl bg-[#262626] border border-[#404040]/50 px-3 py-1.5 text-[14px] font-medium text-[#e5e5e5] hover:bg-[#333333] disabled:opacity-50 transition-colors"
      >
        <RiHistoryLine className="h-4 w-4" />
        History
      </button>

      {/* Main Timeline Modal */}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#171717] border-l border-[#262626] p-6 shadow-2xl overflow-y-auto h-full flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[20px] font-bold text-white tracking-tight">Version History</h2>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-[#262626] text-[#a1a1aa] transition-colors">
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>

            {!disabled && (
              <form onSubmit={handleCreateSnapshot} className="mb-6 flex gap-2">
                <input
                  type="text"
                  placeholder="Snapshot name..."
                  value={newVersionName}
                  onChange={(e) => setNewVersionName(e.target.value)}
                  className="flex-1 rounded-xl border border-[#404040]/50 bg-[#262626] px-4 py-2.5 text-[14px] text-white placeholder-[#737373] focus:border-[#e60000] focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={saving || !newVersionName.trim()}
                  className="flex items-center gap-2 rounded-xl bg-[#e60000] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#cc0000] disabled:opacity-50 transition-colors"
                >
                  {saving ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiAddLine className="h-4 w-4" />}
                  Save
                </button>
              </form>
            )}

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <RiLoader4Line className="h-6 w-6 animate-spin text-[#737373]" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-center text-[14px] text-[#a1a1aa] mt-10">No versions saved yet.</p>
              ) : (
                <div className="space-y-4">
                  {versions.map((v) => (
                    <div key={v.id} className="rounded-2xl border border-[#262626] bg-[#0a0a0a] p-5">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold text-white text-[15px]">{v.name}</h3>
                        <span className="text-[12px] text-[#a1a1aa]">
                          {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mb-4 text-[13px] text-[#a1a1aa]">Saved by <span className="text-[#e5e5e5]">{v.user.name}</span></p>
                      
                      <button
                        onClick={() => handlePreview(v)}
                        className="w-full rounded-xl bg-[#262626] py-2 text-[14px] font-medium text-[#e5e5e5] hover:bg-[#333333] transition-colors border border-[#404040]/50"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 lg:p-10">
          <div className="flex h-full w-full max-w-5xl flex-col rounded-2xl bg-[#171717] border border-[#262626] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262626] p-5">
              <div>
                <h2 className="text-[20px] font-bold text-white">Preview: {previewVersion.name}</h2>
                <p className="text-[13px] text-[#a1a1aa] mt-1">
                  {new Date(previewVersion.createdAt).toLocaleString()} by <span className="text-[#e5e5e5]">{previewVersion.user.name}</span>
                </p>
              </div>
              <button onClick={() => setPreviewVersion(null)} className="rounded-full p-2 hover:bg-[#262626] text-[#a1a1aa] transition-colors">
                <RiCloseLine className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a]">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center">
                  <RiLoader4Line className="h-8 w-8 animate-spin text-[#737373]" />
                </div>
              ) : (
                <EditorContent editor={previewEditor} />
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#262626] p-5">
              <button
                onClick={() => setPreviewVersion(null)}
                className="rounded-xl px-5 py-2.5 text-[14px] font-medium text-[#e5e5e5] hover:bg-[#262626] border border-transparent transition-colors"
              >
                Cancel
              </button>
              {!disabled && (
                <button
                  onClick={confirmRestore}
                  disabled={previewLoading}
                  className="flex items-center gap-2 rounded-xl bg-[#e60000] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#cc0000] disabled:opacity-50 transition-colors"
                >
                  <RiRestartLine className="h-4 w-4" />
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
