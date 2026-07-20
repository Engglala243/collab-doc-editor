import { describe, it, expect } from "vitest";

import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";

// Mock version generation logic that mirrors the backend
function toBase64(arr: Uint8Array) {
  return btoa(String.fromCharCode(...Array.from(arr)));
}

function fromBase64(str: string) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

describe("Phase 7: Version History & Safe Restore", () => {
  it("should merge updates and encode state vector for snapshots", () => {
    // 1. Create initial document updates
    const ydoc = new Y.Doc();
    const map = ydoc.getMap("test");
    map.set("key", "value1");
    
    // Simulate database update blob
    const update1 = Y.encodeStateAsUpdate(ydoc);
    
    // Create another update
    const ydoc2 = new Y.Doc();
    Y.applyUpdate(ydoc2, update1);
    ydoc2.getMap("test").set("key2", "value2");
    
    const update2 = Y.encodeStateAsUpdate(ydoc2);

    // 2. Snapshot logic (like POST /versions)
    const snapshotDoc = new Y.Doc();
    Y.applyUpdate(snapshotDoc, update1);
    Y.applyUpdate(snapshotDoc, update2);
    
    const stateVector = Y.encodeStateAsUpdate(snapshotDoc);
    const b64 = toBase64(stateVector);

    expect(b64).toBeTruthy();
    
    // 3. Restore logic (like POST /restore)
    const restoreDoc = new Y.Doc();
    Y.applyUpdate(restoreDoc, fromBase64(b64));
    
    expect(restoreDoc.getMap("test").get("key")).toBe("value1");
    expect(restoreDoc.getMap("test").get("key2")).toBe("value2");
  });

  it("should correctly convert Y.Doc to ProseMirror JSON for restoration", () => {
    const ydoc = new Y.Doc();
    const xmlFragment = ydoc.getXmlFragment("default");
    const p = new Y.XmlElement("paragraph");
    p.insert(0, [new Y.XmlText("Hello Restore!")]);
    xmlFragment.insert(0, [p]);

    const json = yDocToProsemirrorJSON(ydoc, "default");
    
    expect(json).toBeDefined();
    expect(json.type).toBe("doc");
    expect(json.content.length).toBe(1);
    expect(json.content[0].type).toBe("paragraph");
    expect(json.content[0].content[0].text).toBe("Hello Restore!");
  });
});
