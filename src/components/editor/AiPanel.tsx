"use client";

import { useState } from "react";
import { Sparkles, X, Loader2, ClipboardCopy, RotateCcw, Check } from "lucide-react";

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
        className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:from-violet-700 hover:to-indigo-700 transition-all"
      >
        <Sparkles className="h-4 w-4" />
        AI
      </button>

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-md rounded-2xl border border-slate-200/50 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">AI Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
            {(["summarize", "rewrite"] as AiMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); setError(null); }}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-colors ${
                  mode === m
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="p-4">
            {mode === "rewrite" && (
              <div className="mb-3">
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder='Instruction (e.g. "make it formal")'
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:focus:border-violet-400"
                />
              </div>
            )}

            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              {mode === "summarize"
                ? "AI will summarize the entire document into key bullet points."
                : "Select text to rewrite just that section, or AI will process the full document."}
            </p>

            <button
              onClick={handleRun}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> {mode === "summarize" ? "Summarize" : "Rewrite"}</>
              )}
            </button>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Result</span>
                  <div className="flex gap-1">
                    <button onClick={handleCopy} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                      {copied ? <Check className="h-3 w-3 text-green-500" /> : <ClipboardCopy className="h-3 w-3" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={() => { setResult(null); }} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <RotateCcw className="h-3 w-3" /> Redo
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm leading-relaxed dark:bg-slate-800">
                  <pre className="whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200">{result}</pre>
                </div>
                {mode === "rewrite" && (
                  <button
                    onClick={handleAccept}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    {accepted ? <><Check className="h-4 w-4" /> Inserted!</> : "Accept & Insert"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
