import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveRole } from "@/lib/permissions";
import { errors } from "@/lib/api-response";
import { z } from "zod";
import * as Y from "yjs";

function fromBase64(str: string) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

function toBase64(arr: Uint8Array) {
  return btoa(String.fromCharCode(...Array.from(arr)));
}

// GET /api/documents/:documentId/versions
// Lists all versions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errors.unauthorized();

    const { documentId } = await params;
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { members: { where: { userId: session.user.id } } },
    });

    if (!document) return errors.notFound("Document not found");

    const role = resolveRole(document.ownerId, session.user.id, document.members[0]?.role);
    if (!role) return errors.forbidden();

    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: true,
        user: { select: { name: true } },
      },
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Versions GET error:", error);
    return errors.serverError();
  }
}

const createVersionSchema = z.object({
  name: z.string().min(1).max(100),
});

// POST /api/documents/:documentId/versions
// Creates a snapshot
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errors.unauthorized();

    const { documentId } = await params;
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { members: { where: { userId: session.user.id } } },
    });

    if (!document) return errors.notFound("Document not found");

    const role = resolveRole(document.ownerId, session.user.id, document.members[0]?.role);
    if (!role || role === "VIEWER") return errors.forbidden();

    const body = await req.json();
    const parsed = createVersionSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest("Invalid version name");
    }

    // To snapshot the document, we must merge all updates to get the current full Y.Doc state
    const updates = await prisma.documentUpdate.findMany({
      where: { documentId },
      orderBy: { serverSequence: "asc" },
    });

    const ydoc = new Y.Doc();
    for (const u of updates) {
      try {
        Y.applyUpdate(ydoc, fromBase64(u.payload));
      } catch (err) {
        console.error(`Failed to apply update ${u.id} during snapshot generation`, err);
      }
    }

    const stateVector = Y.encodeStateAsUpdate(ydoc);
    const content = toBase64(stateVector);

    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        name: parsed.data.name,
        content,
        createdBy: session.user.id,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: true,
        user: { select: { name: true } },
      }
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("Versions POST error:", error);
    return errors.serverError();
  }
}
