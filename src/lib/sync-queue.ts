import { openDB, DBSchema, IDBPDatabase } from "idb";

export type PendingUpdate = {
  id: string;
  documentId: string;
  clientId: string;
  sequence: number;
  payload: string; // base64
  createdAt: number;
  retryCount: number;
};

export type SyncMeta = {
  documentId: string;
  serverSequence: number;
  clientSequence: number; // The client's own monotonically increasing sequence
};

interface SyncDB extends DBSchema {
  updates: {
    key: string;
    value: PendingUpdate;
    indexes: { "by-document": string };
  };
  meta: {
    key: string;
    value: SyncMeta;
  };
}

let dbPromise: Promise<IDBPDatabase<SyncDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<SyncDB>("CollabDocsSync", 1, {
      upgrade(db) {
        const updateStore = db.createObjectStore("updates", { keyPath: "id" });
        updateStore.createIndex("by-document", "documentId");
        
        db.createObjectStore("meta", { keyPath: "documentId" });
      },
    });
  }
  return dbPromise;
}

export const SyncQueue = {
  async addUpdate(update: Omit<PendingUpdate, "retryCount" | "createdAt" | "sequence">): Promise<PendingUpdate> {
    const db = await getDB();
    if (!db) throw new Error("No DB");

    const tx = db.transaction(["updates", "meta"], "readwrite");
    
    // Get and increment clientSequence
    let meta = await tx.objectStore("meta").get(update.documentId);
    if (!meta) {
      meta = { documentId: update.documentId, serverSequence: 0, clientSequence: 0 };
    }
    meta.clientSequence++;
    await tx.objectStore("meta").put(meta);

    const pendingUpdate: PendingUpdate = {
      ...update,
      sequence: meta.clientSequence,
      createdAt: Date.now(),
      retryCount: 0,
    };

    await tx.objectStore("updates").put(pendingUpdate);
    await tx.done;

    return pendingUpdate;
  },

  async getPendingUpdates(documentId: string): Promise<PendingUpdate[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAllFromIndex("updates", "by-document", documentId);
  },

  async removeUpdates(ids: string[]): Promise<void> {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction("updates", "readwrite");
    for (const id of ids) {
      await tx.objectStore("updates").delete(id);
    }
    await tx.done;
  },

  async incrementRetries(ids: string[]): Promise<void> {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction("updates", "readwrite");
    for (const id of ids) {
      const update = await tx.objectStore("updates").get(id);
      if (update) {
        update.retryCount++;
        await tx.objectStore("updates").put(update);
      }
    }
    await tx.done;
  },

  async getMeta(documentId: string): Promise<SyncMeta> {
    const db = await getDB();
    if (!db) return { documentId, serverSequence: 0, clientSequence: 0 };
    const meta = await db.get("meta", documentId);
    return meta || { documentId, serverSequence: 0, clientSequence: 0 };
  },

  async updateServerSequence(documentId: string, serverSequence: number): Promise<void> {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction("meta", "readwrite");
    let meta = await tx.objectStore("meta").get(documentId);
    if (!meta) {
      meta = { documentId, serverSequence, clientSequence: 0 };
    } else {
      meta.serverSequence = Math.max(meta.serverSequence, serverSequence);
    }
    await tx.objectStore("meta").put(meta);
    await tx.done;
  }
};
