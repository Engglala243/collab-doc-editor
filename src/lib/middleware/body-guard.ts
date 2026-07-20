/**
 * Body Guard — validates request body size and binary payload integrity.
 *
 * Protects the sync and versions endpoints from:
 *  1. Oversized request bodies that could OOM the server
 *  2. Malformed base64 payloads that would crash Yjs during applyUpdate
 *  3. Garbage document IDs that would trigger unnecessary DB queries
 */

import { errors } from "@/lib/api-response";

// ─── Size limits ──────────────────────────────────────────────────────────────

/** Max size for sync push batches (base64 encoded Yjs updates). */
export const SYNC_BODY_MAX_BYTES = 512 * 1024; // 512 KB

/** Max size for text-based API bodies (document title, version name, AI text). */
export const TEXT_BODY_MAX_BYTES = 50 * 1024; // 50 KB

/** Max individual Yjs update payload in base64 characters (256 KB of binary data). */
export const UPDATE_PAYLOAD_MAX_BASE64_CHARS = Math.ceil((256 * 1024 * 4) / 3);

/** Max number of updates allowed in a single sync batch. */
export const SYNC_BATCH_MAX_UPDATES = 50;

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Validates that a string is valid base64 AND decodes to a plausible Yjs update.
 * Yjs updates always start with specific bytes (not empty).
 */
export function isValidBase64Payload(str: string): boolean {
  if (typeof str !== "string" || str.length === 0) return false;
  if (str.length > UPDATE_PAYLOAD_MAX_BASE64_CHARS) return false;

  // Must match the base64 character set (with optional = padding)
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) return false;

  // Attempt actual decode — catches invalid padding
  try {
    const decoded = Buffer.from(str, "base64");
    // Yjs updates are never empty
    return decoded.length > 0;
  } catch {
    return false;
  }
}

/**
 * Validates that a CUID / CUID2 string looks plausible before hitting the DB.
 * Prevents injecting garbage that could slow down indexed queries.
 */
export function isValidId(id: string): boolean {
  return typeof id === "string" && /^[a-z0-9]{20,30}$/.test(id);
}

/**
 * Checks Content-Length header against a byte limit.
 * Returns an error response if exceeded, or null if OK.
 */
export function checkContentLength(req: Request, maxBytes: number) {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const bytes = parseInt(contentLength, 10);
    if (!isNaN(bytes) && bytes > maxBytes) {
      return errors.payloadTooLarge(maxBytes);
    }
  }
  return null;
}

/**
 * Validates all update payloads in a sync batch.
 * Returns the first invalid index and reason, or null if all are valid.
 */
export function validateSyncUpdates(
  updates: Array<{ id: string; sequence: number; payload: string }>
): { index: number; reason: string } | null {
  if (updates.length > SYNC_BATCH_MAX_UPDATES) {
    return { index: -1, reason: `Batch too large: max ${SYNC_BATCH_MAX_UPDATES} updates per call` };
  }

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    if (!u) continue;

    if (typeof u.id !== "string" || u.id.length === 0) {
      return { index: i, reason: "Update missing id" };
    }

    if (typeof u.sequence !== "number" || u.sequence < 0 || !Number.isInteger(u.sequence)) {
      return { index: i, reason: "Update has invalid sequence number" };
    }

    if (!isValidBase64Payload(u.payload)) {
      return { index: i, reason: `Update[${i}] has malformed or oversized base64 payload` };
    }
  }

  return null;
}
