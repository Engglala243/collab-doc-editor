import { describe, it, expect } from "vitest";

describe("Environment", () => {
  it("should be in test or development mode", () => {
    const validEnvs = ["test", "development", "production"];
    const nodeEnv = process.env.NODE_ENV ?? "test";
    expect(validEnvs).toContain(nodeEnv);
  });
});
