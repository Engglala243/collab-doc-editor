import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { compact, shouldCompact, COMPACTION_THRESHOLD } from "@/lib/compactor";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentUpdate: {
      count: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    documentCheckpoint: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { vi } from "vitest";
import { prisma } from "@/lib/prisma";

function toBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString("base64");
}

describe("Compactor", () => {
  it("should report no compaction needed below threshold", async () => {
    vi.mocked(prisma.documentUpdate.count).mockResolvedValue(COMPACTION_THRESHOLD - 1);
    const needs = await shouldCompact("doc-1");
    expect(needs).toBe(false);
  });

  it("should report compaction needed at or above threshold", async () => {
    vi.mocked(prisma.documentUpdate.count).mockResolvedValue(COMPACTION_THRESHOLD);
    const needs = await shouldCompact("doc-2");
    expect(needs).toBe(true);
  });

  it("should merge Yjs updates correctly during compaction", async () => {
    // Create 2 Yjs updates
    const ydoc1 = new Y.Doc();
    ydoc1.getMap("data").set("key1", "value1");
    const update1 = Y.encodeStateAsUpdate(ydoc1);

    const ydoc2 = new Y.Doc();
    Y.applyUpdate(ydoc2, update1);
    ydoc2.getMap("data").set("key2", "value2");
    const update2 = Y.encodeStateAsUpdate(ydoc2);

    // No existing checkpoint
    vi.mocked(prisma.documentCheckpoint.findUnique).mockResolvedValue(null);

    // Return 2 mock updates from DB
    vi.mocked(prisma.documentUpdate.findMany).mockResolvedValue([
      { id: "u1", documentId: "doc-3", clientId: "c1", sequence: 0, serverSequence: 1, createdAt: new Date(), payload: toBase64(update1) },
      { id: "u2", documentId: "doc-3", clientId: "c1", sequence: 1, serverSequence: 2, createdAt: new Date(), payload: toBase64(update2) },
    ]);
    vi.mocked(prisma.documentCheckpoint.upsert).mockResolvedValue({ id: "cp1", documentId: "doc-3", content: "", serverSequence: 2, createdAt: new Date() });
    vi.mocked(prisma.documentUpdate.deleteMany).mockResolvedValue({ count: 2 });

    const deleted = await compact("doc-3");

    // Should have deleted 2 rows
    expect(deleted).toBe(2);

    // Verify the checkpoint content represents the merged state
    const upsertCall = vi.mocked(prisma.documentCheckpoint.upsert).mock.calls[0];
    expect(upsertCall).toBeDefined();
    const checkpointContent = upsertCall![0].create.content;
    const restoredDoc = new Y.Doc();
    Y.applyUpdate(restoredDoc, Buffer.from(checkpointContent, "base64"));
    expect(restoredDoc.getMap("data").get("key1")).toBe("value1");
    expect(restoredDoc.getMap("data").get("key2")).toBe("value2");
  });

  it("should handle no updates gracefully", async () => {
    vi.mocked(prisma.documentCheckpoint.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.documentUpdate.findMany).mockResolvedValue([]);
    const deleted = await compact("doc-4");
    expect(deleted).toBe(0);
  });
});
