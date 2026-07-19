"use client";

import { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import Placeholder from "@tiptap/extension-placeholder";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { Toolbar } from "./Toolbar";
import { Cloud, CloudOff, Loader2, CloudAlert, CloudLightning } from "lucide-react";

export type SyncState = "Saved locally" | "Unsynced changes" | "Syncing" | "Synced" | "Sync failed";

interface EditorProps {
  documentId: string;
  initialContent?: string; // base64 encoded Yjs state, if any from server
}

function toBase64(arr: Uint8Array) {
  return btoa(String.fromCharCode(...Array.from(arr)));
}

function fromBase64(str: string) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export function Editor({ documentId, initialContent }: EditorProps) {
  const [syncState, setSyncState] = useState<SyncState>("Saved locally");
  const [ydoc] = useState(() => new Y.Doc());
  const providerRef = useRef<IndexeddbPersistence | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    // Apply initial server state if provided and not yet initialized locally
    if (initialContent) {
      try {
        const update = fromBase64(initialContent);
        Y.applyUpdate(ydoc, update);
      } catch (e) {
        console.error("Failed to parse initial content", e);
      }
    }

    // Connect to IndexedDB for local persistence
    const provider = new IndexeddbPersistence(`doc-${documentId}`, ydoc);
    providerRef.current = provider;

    provider.on("synced", () => {
      console.log("Loaded from IndexedDB");
      setSyncState("Saved locally");
    });

    ydoc.on("update", () => {
      isDirtyRef.current = true;
      setSyncState("Unsynced changes");
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId, initialContent, ydoc]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false, // History is handled by Yjs
      }),
      Placeholder.configure({
        placeholder: "Start typing here...",
      }),
      Collaboration.configure({
        document: ydoc,
      }),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-slate dark:prose-invert max-w-none min-h-[500px] focus:outline-none p-4",
      },
    },
  });

  // Background Sync Loop
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      if (!isDirtyRef.current || !navigator.onLine) {
        return;
      }

      setSyncState("Syncing");
      try {
        const stateVector = Y.encodeStateAsUpdate(ydoc);
        const base64Content = toBase64(stateVector);

        const res = await fetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: base64Content }),
        });

        if (!res.ok) throw new Error("Sync failed");

        isDirtyRef.current = false;
        setSyncState("Synced");
      } catch (error) {
        console.error("Sync error:", error);
        setSyncState("Sync failed");
      }
    }, 5000); // Try to sync every 5 seconds

    return () => clearInterval(syncInterval);
  }, [documentId, ydoc]);

  return (
    <div className="flex flex-col gap-4">
      {/* Top Bar with Toolbar and Sync Status */}
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border border-slate-200 bg-white/80 p-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
        <Toolbar editor={editor} />
        
        <div className="flex items-center gap-2 px-2 text-sm text-slate-500">
          {syncState === "Saved locally" && <Cloud className="h-4 w-4" />}
          {syncState === "Unsynced changes" && <CloudOff className="h-4 w-4 text-orange-500" />}
          {syncState === "Syncing" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          {syncState === "Synced" && <CloudLightning className="h-4 w-4 text-green-500" />}
          {syncState === "Sync failed" && <CloudAlert className="h-4 w-4 text-red-500" />}
          <span className="hidden sm:inline">{syncState}</span>
        </div>
      </div>

      {/* Editor Area */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
