/**
 * Compactor — merges all DocumentUpdates for a document into a single
 * DocumentCheckpoint, then prunes the old update rows.
 *
 * This keeps the database lean as documents grow. It is triggered
 * automatically after a version snapshot is created (async, non-blocking).
 *
 * Algorithm:
 *  1. Read existing checkpoint (if any) — start Y.Doc from there
 *  2. Read all updates with serverSequence > checkpoint.serverSequence
 *  3. Apply updates to Y.Doc
 *  4. Encode final state vector → save as new checkpoint (upsert)
 *  5. Delete all individual update rows that were merged
 *
 * Safety: If anything fails, the original updates are left intact.
 * The next compaction attempt will succeed.
 */

import * as Y from "yjs";
import { prisma } from "@/lib/prisma";

/** Trigger compaction when update count exceeds this threshold */
export const COMPACTION_THRESHOLD = 200;

function toBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString("base64");
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

/**
 * Checks if compaction should run for a document.
 * Returns true if update count exceeds the threshold.
 */
export async function shouldCompact(documentId: string): Promise<boolean> {
  const count = await prisma.documentUpdate.count({ where: { documentId } });
  return count >= COMPACTION_THRESHOLD;
}

/**
 * Runs compaction for a single document.
 * Safe to call multiple times — idempotent via upsert.
 *
 * @returns The number of update rows deleted (0 if nothing to compact)
 */
export async function compact(documentId: string): Promise<number> {
  const ydoc = new Y.Doc();
  let baseSequence = 0;

  // 1. Load from existing checkpoint if available
  const checkpoint = await prisma.documentCheckpoint.findUnique({
    where: { documentId },
  });

  if (checkpoint) {
    try {
      Y.applyUpdate(ydoc, fromBase64(checkpoint.content));
      baseSequence = checkpoint.serverSequence;
    } catch (err) {
      console.error(`[Compactor] Failed to apply checkpoint for ${documentId}:`, err);
      // Continue from scratch — the checkpoint might be corrupt
      baseSequence = 0;
    }
  }

  // 2. Fetch all updates since the checkpoint
  const updates = await prisma.documentUpdate.findMany({
    where: {
      documentId,
      serverSequence: { gt: baseSequence },
    },
    orderBy: { serverSequence: "asc" },
  });

  if (updates.length === 0) {
    console.log(`[Compactor] Nothing to compact for ${documentId}`);
    return 0;
  }

  // 3. Apply all updates to the Y.Doc
  const failedIds: string[] = [];
  for (const u of updates) {
    try {
      Y.applyUpdate(ydoc, fromBase64(u.payload));
    } catch (err) {
      console.error(`[Compactor] Skipping corrupt update ${u.id}:`, err);
      failedIds.push(u.id);
    }
  }

  // 4. Encode final merged state and upsert checkpoint
  const mergedState = toBase64(Y.encodeStateAsUpdate(ydoc));
  const maxSequence = Math.max(...updates.map((u) => u.serverSequence));

  await prisma.documentCheckpoint.upsert({
    where: { documentId },
    create: { documentId, content: mergedState, serverSequence: maxSequence },
    update: { content: mergedState, serverSequence: maxSequence },
  });

  // 5. Delete successfully merged updates (keep failed ones for debugging)
  const idsToDelete = updates
    .map((u) => u.id)
    .filter((id) => !failedIds.includes(id));

  if (idsToDelete.length > 0) {
    await prisma.documentUpdate.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }

  console.log(
    `[Compactor] Compacted ${idsToDelete.length} updates for document ${documentId} (${failedIds.length} failed, kept)`
  );

  return idsToDelete.length;
}

/**
 * Run compaction only if the threshold is exceeded.
 * Designed to be called fire-and-forget (don't await in hot paths).
 */
export async function compactIfNeeded(documentId: string): Promise<void> {
  try {
    if (await shouldCompact(documentId)) {
      await compact(documentId);
    }
  } catch (err) {
    // Compaction failure must NEVER affect the calling request
    console.error(`[Compactor] Unexpected error for ${documentId}:`, err);
  }
}
