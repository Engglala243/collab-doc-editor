import { describe, it, expect } from "vitest";
import { SyncQueue } from "@/lib/sync-queue";
import { z } from "zod";

// Test the Zod schema used in the API
const SyncSchema = z.object({
  clientId: z.string(),
  serverSequence: z.number().nonnegative(),
  updates: z.array(
    z.object({
      id: z.string(),
      sequence: z.number().nonnegative(),
      payload: z.string(),
    })
  ),
});

describe("Sync Engine - Unit Tests", () => {
  describe("API Payload Validation", () => {
    it("accepts valid sync payloads", () => {
      const validPayload = {
        clientId: "client-123",
        serverSequence: 5,
        updates: [
          { id: "uuid-1", sequence: 1, payload: "base64==" },
        ],
      };
      expect(SyncSchema.safeParse(validPayload).success).toBe(true);
    });

    it("rejects negative server sequences", () => {
      const invalidPayload = {
        clientId: "client-123",
        serverSequence: -1,
        updates: [],
      };
      expect(SyncSchema.safeParse(invalidPayload).success).toBe(false);
    });

    it("rejects missing payload fields", () => {
      const invalidPayload = {
        clientId: "client-123",
        serverSequence: 1,
        updates: [
          { id: "uuid-1", sequence: 1 }, // Missing payload
        ],
      };
      expect(SyncSchema.safeParse(invalidPayload).success).toBe(false);
    });
  });

  describe("SyncQueue (IndexedDB Wrapper)", () => {
    // Note: In Node.js environments (like Vitest without jsdom/indexeddb-mock), 
    // real IndexedDB is not available. We test the interface handling.
    it("exposes necessary queue methods", () => {
      expect(typeof SyncQueue.addUpdate).toBe("function");
      expect(typeof SyncQueue.getPendingUpdates).toBe("function");
      expect(typeof SyncQueue.removeUpdates).toBe("function");
      expect(typeof SyncQueue.incrementRetries).toBe("function");
      expect(typeof SyncQueue.getMeta).toBe("function");
      expect(typeof SyncQueue.updateServerSequence).toBe("function");
    });
  });
});
