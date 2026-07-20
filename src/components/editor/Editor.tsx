"use client";

import { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import { Toolbar } from "./Toolbar";
import { RiCloudLine, RiCloudOffLine, RiLoader4Line, RiErrorWarningLine, RiFlashlightLine, RiGroupLine } from "react-icons/ri";
import { SyncQueue } from "@/lib/sync-queue";
import { v4 as uuidv4 } from "uuid";

import { VersionsPanel } from "./VersionsPanel";
import { AiPanel } from "./AiPanel";

export type SyncState = "Saved locally" | "Unsynced changes" | "Syncing" | "Synced" | "Sync failed";

interface EditorProps {
  documentId: string;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

function toBase64(arr: Uint8Array) {
  return btoa(String.fromCharCode(...Array.from(arr)));
}

function fromBase64(str: string) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

const userColors = [
  "#f783ac", "#845ef7", "#339af0", "#20c997", "#fcc419", "#ff922b", "#ff6b6b",
];

export function Editor({ documentId, currentUser }: EditorProps) {
  const [syncState, setSyncState] = useState<SyncState>("Syncing");
  const [connectedUsers, setConnectedUsers] = useState(1);
  const [ydoc] = useState(() => new Y.Doc());
  const providerRef = useRef<IndexeddbPersistence | null>(null);
  const [wsProvider, setWsProvider] = useState<WebsocketProvider | null>(null);
  const clientIdRef = useRef<string>("");

  useEffect(() => {
    // Generate or retrieve a consistent clientId for this session
    let cid = sessionStorage.getItem(`clientId-${documentId}`);
    if (!cid) {
      cid = uuidv4();
      sessionStorage.setItem(`clientId-${documentId}`, cid);
    }
    clientIdRef.current = cid;

    // 1. IndexedDB Persistence (Local Storage)
    const provider = new IndexeddbPersistence(`doc-${documentId}`, ydoc);
    providerRef.current = provider;

    provider.on("synced", () => {
      console.log("Loaded from IndexedDB");
      setSyncState("Saved locally");
    });

    // 2. WebSocket Provider (Live Relay)
    const wsUrl = window.location.hostname === "localhost" ? "ws://localhost:3001" : `wss://${window.location.host}`;
    const newWsProvider = new WebsocketProvider(wsUrl, documentId, ydoc, {
      params: { userId: currentUser.id },
    });

    newWsProvider.awareness.setLocalStateField("user", {
      name: currentUser.name,
      color: userColors[Math.abs(hashCode(currentUser.id)) % userColors.length] || "#845ef7",
    });

    newWsProvider.awareness.on("change", () => {
      setConnectedUsers(newWsProvider.awareness.getStates().size);
    });
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWsProvider(newWsProvider);

    // 3. Local Sync Queue for REST Fallback (Persistence Guarantee)
    const handleUpdate = async (update: Uint8Array, origin: unknown) => {
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
      newWsProvider.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId, ydoc, currentUser.id, currentUser.name]);

  const isViewer = currentUser.role === "VIEWER";

  const editor = useEditor({
    editable: !isViewer,
    extensions: [
      StarterKit.configure({
        undoRedo: false, // History is handled by Yjs
      }),
      Placeholder.configure({
        placeholder: isViewer ? "You have view-only access." : "Start typing here...",
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      ...(wsProvider ? [
        CollaborationCursor.configure({
          provider: wsProvider,
          user: { name: currentUser.name, color: userColors[Math.abs(hashCode(currentUser.id)) % userColors.length] || "#845ef7" },
        })
      ] : []),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none min-h-[500px] focus:outline-none p-6 text-[#e5e5e5]",
      },
    },
  });


  // Background REST Sync Loop (Phase 5)
  useEffect(() => {
    let isSyncing = false;
    
    const syncInterval = setInterval(async () => {
      if (isSyncing || !navigator.onLine) return;

      const pendingUpdates = await SyncQueue.getPendingUpdates(documentId);
      const meta = await SyncQueue.getMeta(documentId);
      
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
        
        if (data.acknowledgedIds && data.acknowledgedIds.length > 0) {
          await SyncQueue.removeUpdates(data.acknowledgedIds);
        }

        if (data.remoteUpdates && data.remoteUpdates.length > 0) {
          for (const update of data.remoteUpdates) {
            const binaryUpdate = fromBase64(update.payload);
            Y.applyUpdate(ydoc, binaryUpdate, "remote");
          }
        }

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
        console.error("REST Sync error:", error);
        if (pendingUpdates.length > 0) {
          await SyncQueue.incrementRetries(pendingUpdates.map(u => u.id));
          setSyncState("Sync failed");
        }
      } finally {
        isSyncing = false;
      }
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [documentId, ydoc]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between border-b border-[#262626] bg-[#171717] p-3 gap-3">
        {!isViewer ? <Toolbar editor={editor} /> : <div className="text-[14px] font-medium text-[#a1a1aa] px-2">View Only</div>}
        
        <div className="flex items-center gap-4 px-2 text-[14px] text-[#a1a1aa]">
          <div className="flex items-center gap-1.5 bg-[#262626] text-[#e5e5e5] px-3 py-1.5 rounded-xl border border-[#404040]/50">
            <RiGroupLine className="h-4 w-4" />
            <span className="font-semibold">{connectedUsers}</span>
          </div>

          <div className="flex items-center gap-2">
            {syncState === "Saved locally" && <RiCloudLine className="h-4 w-4 text-[#a1a1aa]" />}
            {syncState === "Unsynced changes" && <RiCloudOffLine className="h-4 w-4 text-orange-500" />}
            {syncState === "Syncing" && <RiLoader4Line className="h-4 w-4 animate-spin text-blue-500" />}
            {syncState === "Synced" && <RiFlashlightLine className="h-4 w-4 text-green-500" />}
            {syncState === "Sync failed" && <RiErrorWarningLine className="h-4 w-4 text-[#e60000]" />}
            <span className="hidden sm:inline font-medium">{syncState}</span>
          </div>
          
          <div className="h-6 w-px bg-[#404040]/50 mx-1" />
          
          <VersionsPanel 
            documentId={documentId} 
            disabled={isViewer}
            onRestore={(json) => {
              if (editor) {
                editor.commands.setContent(json);
              }
            }} 
          />

          <div className="h-6 w-px bg-[#404040]/50 mx-1" />

          <AiPanel
            documentId={documentId}
            getEditorText={() => editor?.getText() ?? ""}
            getSelectedText={() => editor?.state.doc.textBetween(
              editor.state.selection.from,
              editor.state.selection.to,
            ) ?? ""}
            onInsert={(text) => {
              if (editor) {
                editor.chain().focus().insertContent(text).run();
              }
            }}
          />
        </div>
      </div>

      <div className="bg-[#0a0a0a]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
