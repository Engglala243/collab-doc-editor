import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/middleware/rate-limiter";
import { isValidBase64Payload, validateSyncUpdates, SYNC_BATCH_MAX_UPDATES } from "@/lib/middleware/body-guard";

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

describe("Rate Limiter", () => {
  it("should allow requests under the limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.check("user1").allowed).toBe(true);
    expect(limiter.check("user1").allowed).toBe(true);
    expect(limiter.check("user1").allowed).toBe(true);
  });

  it("should block the N+1 request", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    limiter.check("user2");
    limiter.check("user2");
    limiter.check("user2");
    const result = limiter.check("user2");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("should track users independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const r1 = limiter.check("userA");
    const r2 = limiter.check("userB");
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(limiter.check("userA").allowed).toBe(false);
    expect(limiter.check("userB").allowed).toBe(false);
  });

  it("should return correct remaining count", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
    const r = limiter.check("user3");
    expect(r.remaining).toBe(4);
    limiter.check("user3");
    const r2 = limiter.check("user3");
    expect(r2.remaining).toBe(2);
  });
});

// ─── Body Guard ───────────────────────────────────────────────────────────────

describe("Body Guard — isValidBase64Payload", () => {
  it("should accept a valid base64 encoded Yjs update", () => {
    // Small valid Yjs-like binary encoded as base64
    const valid = Buffer.from(new Uint8Array([1, 2, 3, 4, 5])).toString("base64");
    expect(isValidBase64Payload(valid)).toBe(true);
  });

  it("should reject an empty string", () => {
    expect(isValidBase64Payload("")).toBe(false);
  });

  it("should reject invalid base64 characters", () => {
    expect(isValidBase64Payload("not-valid-base64!@#$")).toBe(false);
  });

  it("should reject an oversized payload", () => {
    const bigPayload = "A".repeat(400_000);
    expect(isValidBase64Payload(bigPayload)).toBe(false);
  });
});

describe("Body Guard — validateSyncUpdates", () => {
  it("should pass a valid batch", () => {
    const payload = Buffer.from(new Uint8Array([1, 2, 3])).toString("base64");
    const updates = [
      { id: "update-1", sequence: 0, payload },
      { id: "update-2", sequence: 1, payload },
    ];
    expect(validateSyncUpdates(updates)).toBeNull();
  });

  it("should reject a batch exceeding max updates", () => {
    const payload = Buffer.from(new Uint8Array([1])).toString("base64");
    const updates = Array.from({ length: SYNC_BATCH_MAX_UPDATES + 1 }, (_, i) => ({
      id: `u-${i}`,
      sequence: i,
      payload,
    }));
    const result = validateSyncUpdates(updates);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain("Batch too large");
  });

  it("should reject an update with malformed base64", () => {
    const updates = [{ id: "update-1", sequence: 0, payload: "NOT!VALID!BASE64" }];
    const result = validateSyncUpdates(updates);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain("malformed");
  });

  it("should reject an update with missing id", () => {
    const payload = Buffer.from(new Uint8Array([1])).toString("base64");
    const updates = [{ id: "", sequence: 0, payload }];
    const result = validateSyncUpdates(updates);
    expect(result).not.toBeNull();
    expect(result?.reason).toContain("id");
  });
});
