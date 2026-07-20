import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveRole } from "@/lib/permissions";
import { errors } from "@/lib/api-response";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";

function fromBase64(str: string) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

// POST /api/documents/:documentId/versions/:versionId/restore
// Converts the old version's Y.Doc state into ProseMirror JSON and returns it
// so the frontend can inject it safely, creating a CRDT-safe "new head"
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string; versionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errors.unauthorized();

    const { documentId, versionId } = await params;
    
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { members: { where: { userId: session.user.id } } },
    });

    if (!document) return errors.notFound("Document not found");

    const role = resolveRole(document.ownerId, session.user.id, document.members[0]?.role);
    if (!role || role === "VIEWER") return errors.forbidden();

    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.documentId !== documentId) {
      return errors.notFound("Version not found");
    }

    // Convert old base64 state back to Y.Doc
    const ydoc = new Y.Doc();
    try {
      Y.applyUpdate(ydoc, fromBase64(version.content));
    } catch (err) {
      console.error("Failed to parse version content:", err);
      return errors.serverError();
    }

    // Extract ProseMirror JSON from the "default" XmlFragment used by TipTap
    const json = yDocToProsemirrorJSON(ydoc, "default");

    return NextResponse.json({
      success: true,
      restoredJson: json,
    });
  } catch (error) {
    console.error("Version Restore POST error:", error);
    return errors.serverError();
  }
}
