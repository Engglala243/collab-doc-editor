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
import { SyncQueue } from "@/lib/sync-queue";
import { v4 as uuidv4 } from "uuid";

export type SyncState = "Saved locally" | "Unsynced changes" | "Syncing" | "Synced" | "Sync failed";

interface EditorProps {
  documentId: string;
}

function toBase64(arr: Uint8Array) {
  return btoa(String.fromCharCode(...Array.from(arr)));
}

function fromBase64(str: string) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export function Editor({ documentId }: EditorProps) {
  const [syncState, setSyncState] = useState<SyncState>("Syncing");
  const [ydoc] = useState(() => new Y.Doc());
  const providerRef = useRef<IndexeddbPersistence | null>(null);
  const clientIdRef = useRef<string>("");

  useEffect(() => {
    // Generate or retrieve a consistent clientId for this session
    let cid = sessionStorage.getItem(`clientId-${documentId}`);
    if (!cid) {
      cid = uuidv4();
      sessionStorage.setItem(`clientId-${documentId}`, cid);
    }
    clientIdRef.current = cid;

    // Connect to IndexedDB for local persistence of the full merged document
    const provider = new IndexeddbPersistence(`doc-${documentId}`, ydoc);
    providerRef.current = provider;

    provider.on("synced", () => {
      console.log("Loaded from IndexedDB");
      setSyncState("Saved locally");
    });

    const handleUpdate = async (update: Uint8Array, origin: unknown) => {
      // We only queue updates that came from local typing or transactions,
      // NOT updates that we just applied from the network sync.
      if (origin !== "remote") {
        setSyncState("Unsynced changes");
        const payload = toBase64(update);
        await SyncQueue.addUpdate({
          id: uuidv4(),
          documentId,
          clientId: clientIdRef.current,
          payload,
        });
      }
    };

    ydoc.on("update", handleUpdate);

    return () => {
      ydoc.off("update", handleUpdate);
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId, ydoc]);

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
    let isSyncing = false;
    
    const syncInterval = setInterval(async () => {
      if (isSyncing || !navigator.onLine) return;

      const pendingUpdates = await SyncQueue.getPendingUpdates(documentId);
      const meta = await SyncQueue.getMeta(documentId);
      
      // If no local updates and we recently checked for remote updates, we might still want to poll occasionally,
      // but to save bandwidth, in a real app this would use WebSockets (Phase 5 bonus/Phase 6).
      // Here, we just hit the endpoint if there's pending updates or periodically anyway.

      isSyncing = true;
      if (pendingUpdates.length > 0) {
        setSyncState("Syncing");
      }

      try {
        const payload = {
          clientId: clientIdRef.current,
          serverSequence: meta.serverSequence,
          updates: pendingUpdates.map(u => ({
            id: u.id,
            sequence: u.sequence,
            payload: u.payload
          }))
        };

        const res = await fetch(`/api/documents/${documentId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Sync failed");

        const data = await res.json();
        
        // 1. Remove acknowledged updates
        if (data.acknowledgedIds && data.acknowledgedIds.length > 0) {
          await SyncQueue.removeUpdates(data.acknowledgedIds);
        }

        // 2. Apply remote updates
        if (data.remoteUpdates && data.remoteUpdates.length > 0) {
          for (const update of data.remoteUpdates) {
            const binaryUpdate = fromBase64(update.payload);
            // Apply update and mark origin as 'remote' so we don't queue it back
            Y.applyUpdate(ydoc, binaryUpdate, "remote");
          }
        }

        // 3. Update server sequence
        if (data.serverSequence > meta.serverSequence) {
          await SyncQueue.updateServerSequence(documentId, data.serverSequence);
        }

        const remaining = await SyncQueue.getPendingUpdates(documentId);
        if (remaining.length === 0) {
          setSyncState("Synced");
        } else {
          setSyncState("Unsynced changes");
        }
      } catch (error) {
        console.error("Sync error:", error);
        if (pendingUpdates.length > 0) {
          await SyncQueue.incrementRetries(pendingUpdates.map(u => u.id));
          setSyncState("Sync failed");
        }
      } finally {
        isSyncing = false;
      }
    }, 5000); // Poll and push every 5 seconds

    return () => clearInterval(syncInterval);
  }, [documentId, ydoc]);

  return (
    <div className="flex flex-col gap-4">
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

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
