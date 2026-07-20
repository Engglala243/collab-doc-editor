import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveRole } from "@/lib/permissions";
import { errors } from "@/lib/api-response";
import { z } from "zod";
import * as Y from "yjs";
import { versionLimiter } from "@/lib/middleware/rate-limiter";
import { checkContentLength, TEXT_BODY_MAX_BYTES } from "@/lib/middleware/body-guard";
import { compactIfNeeded } from "@/lib/compactor";

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

    // Rate limit snapshot creation
    const rl = versionLimiter.check(session.user.id);
    if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter);

    // Body size guard
    const sizeError = checkContentLength(req, TEXT_BODY_MAX_BYTES);
    if (sizeError) return sizeError;

    const body = await req.json();
    const parsed = createVersionSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest("Invalid version name");
    }

    // Build snapshot: start from checkpoint if available, apply only delta updates
    const checkpoint = await prisma.documentCheckpoint.findUnique({
      where: { documentId },
    });

    const ydoc = new Y.Doc();
    let afterSequence = 0;

    if (checkpoint) {
      try {
        Y.applyUpdate(ydoc, fromBase64(checkpoint.content));
        afterSequence = checkpoint.serverSequence;
      } catch {
        // Fallback: rebuild from all updates
        afterSequence = 0;
      }
    }

    const updates = await prisma.documentUpdate.findMany({
      where: { documentId, serverSequence: { gt: afterSequence } },
      orderBy: { serverSequence: "asc" },
    });

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

    // Fire-and-forget compaction — runs in the background without blocking the response
    compactIfNeeded(documentId).catch((err) =>
      console.error("[versions] Compaction error:", err)
    );

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("Versions POST error:", error);
    return errors.serverError();
  }
}
