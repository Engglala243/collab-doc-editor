import { describe, it, expect } from "vitest";
import { canView, canEdit, canManage, resolveRole } from "@/lib/permissions";

describe("canView", () => {
  it("allows OWNER", () => expect(canView("OWNER")).toBe(true));
  it("allows EDITOR", () => expect(canView("EDITOR")).toBe(true));
  it("allows VIEWER", () => expect(canView("VIEWER")).toBe(true));
  it("denies null", () => expect(canView(null)).toBe(false));
  it("denies undefined", () => expect(canView(undefined)).toBe(false));
});

describe("canEdit", () => {
  it("allows OWNER", () => expect(canEdit("OWNER")).toBe(true));
  it("allows EDITOR", () => expect(canEdit("EDITOR")).toBe(true));
  it("denies VIEWER", () => expect(canEdit("VIEWER")).toBe(false));
  it("denies null", () => expect(canEdit(null)).toBe(false));
});

describe("canManage", () => {
  it("allows OWNER", () => expect(canManage("OWNER")).toBe(true));
  it("denies EDITOR", () => expect(canManage("EDITOR")).toBe(false));
  it("denies VIEWER", () => expect(canManage("VIEWER")).toBe(false));
  it("denies null", () => expect(canManage(null)).toBe(false));
});

describe("resolveRole", () => {
  it("returns OWNER when ownerId matches userId", () => {
    expect(resolveRole("user-1", "user-1")).toBe("OWNER");
  });

  it("returns member role when not owner", () => {
    expect(resolveRole("user-1", "user-2", "EDITOR")).toBe("EDITOR");
  });

  it("returns VIEWER role correctly", () => {
    expect(resolveRole("user-1", "user-2", "VIEWER")).toBe("VIEWER");
  });

  it("returns null when no access", () => {
    expect(resolveRole("user-1", "user-2")).toBeNull();
  });

  it("returns null when memberRole is null", () => {
    expect(resolveRole("user-1", "user-2", null)).toBeNull();
  });
});
