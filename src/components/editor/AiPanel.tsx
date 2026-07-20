"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  RiSparklingFill, 
  RiCloseLine, 
  RiLoader4Line, 
  RiClipboardLine, 
  RiRestartLine, 
  RiCheckLine 
} from "react-icons/ri";

interface AiPanelProps {
  documentId: string;
  getEditorText: () => string;
  getSelectedText: () => string;
  onInsert: (text: string) => void;
}

type AiMode = "summarize" | "rewrite";

export function AiPanel({ documentId, getEditorText, getSelectedText, onInsert }: AiPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AiMode>("summarize");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleRun = async () => {
    const text = mode === "rewrite" && getSelectedText()
      ? getSelectedText()
      : getEditorText();

    if (!text || text.trim().length < 10) {
      setError(mode === "rewrite"
        ? "Select some text first, or type more content to rewrite."
        : "Document needs at least a few sentences to summarize.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setAccepted(false);

    try {
      const res = await fetch(`/api/documents/${documentId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          text: text.slice(0, 15000), // stay within limits
          instruction: instruction.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "AI request failed");
      } else {
        setResult(data.result);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAccept = () => {
    if (!result) return;
    onInsert(result);
    setAccepted(true);
    setTimeout(() => {
      setIsOpen(false);
      setResult(null);
      setAccepted(false);
    }, 800);
  };

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); setResult(null); setError(null); }}
        className="flex items-center gap-1.5 rounded-xl bg-[#e60000] hover:bg-[#cc0000] px-3 py-1.5 text-[14px] font-semibold text-white transition-all shadow-sm"
      >
        <RiSparklingFill className="h-4 w-4" />
        AI
      </button>

      {mounted && isOpen && createPortal(
        <>
          {/* Click-outside backdrop */}
          <div
            className="fixed inset-0 z-[70]"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-6 right-6 z-[80] w-full max-w-md rounded-2xl border border-[#262626] bg-[#171717] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#262626] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e60000]">
                <RiSparklingFill className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-white">AI Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-[#262626] text-[#a1a1aa] transition-colors">
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2 border-b border-[#262626] px-4 py-3">
            {(["summarize", "rewrite"] as AiMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); setError(null); }}
                className={`flex-1 rounded-lg py-2 text-[14px] font-semibold capitalize transition-colors border ${
                  mode === m
                    ? "bg-[#262626] text-white border-[#404040]/50"
                    : "text-[#a1a1aa] hover:text-[#e5e5e5] border-transparent hover:bg-[#262626]/50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="p-5">
            {mode === "rewrite" && (
              <div className="mb-4">
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder='Instruction (e.g. "make it formal")'
                  className="w-full rounded-xl border border-[#404040]/50 bg-[#262626] px-4 py-3 text-[14px] text-white placeholder-[#737373] focus:border-[#e60000] focus:outline-none transition-colors"
                />
              </div>
            )}

            <p className="mb-4 text-[13px] text-[#a1a1aa] leading-relaxed">
              {mode === "summarize"
                ? "AI will summarize the entire document into key bullet points."
                : "Select text to rewrite just that section, or AI will process the full document."}
            </p>

            <button
              onClick={handleRun}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e60000] py-3 text-[14px] font-semibold text-white hover:bg-[#cc0000] disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <><RiLoader4Line className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><RiSparklingFill className="h-4 w-4" /> {mode === "summarize" ? "Summarize" : "Rewrite"}</>
              )}
            </button>

            {error && (
              <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[14px] text-red-400">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#a1a1aa]">Result</span>
                  <div className="flex gap-2">
                    <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg border border-[#404040]/50 bg-[#262626] px-2.5 py-1.5 text-[12px] font-medium text-[#e5e5e5] hover:bg-[#333333] transition-colors">
                      {copied ? <RiCheckLine className="h-3.5 w-3.5 text-green-500" /> : <RiClipboardLine className="h-3.5 w-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={() => { setResult(null); }} className="flex items-center gap-1.5 rounded-lg border border-[#404040]/50 bg-[#262626] px-2.5 py-1.5 text-[12px] font-medium text-[#e5e5e5] hover:bg-[#333333] transition-colors">
                      <RiRestartLine className="h-3.5 w-3.5" /> Redo
                    </button>
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-[#404040]/50 bg-[#262626] p-4 text-[14px] leading-relaxed text-[#e5e5e5]">
                  <pre className="whitespace-pre-wrap font-sans">{result}</pre>
                </div>
                {mode === "rewrite" && (
                  <button
                    onClick={handleAccept}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 py-3 text-[14px] font-semibold text-white transition-colors"
                  >
                    {accepted ? <><RiCheckLine className="h-5 w-5" /> Inserted!</> : "Accept & Insert"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        </>,
        document.body
      )}
    </>
  );
}
