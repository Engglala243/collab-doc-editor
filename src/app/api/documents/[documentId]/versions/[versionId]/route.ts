import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveRole } from "@/lib/permissions";
import { errors } from "@/lib/api-response";

// GET /api/documents/:documentId/versions/:versionId
// Returns the specific version including the base64 payload for preview
export async function GET(
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
    if (!role) return errors.forbidden();

    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { user: { select: { name: true } } },
    });

    if (!version || version.documentId !== documentId) {
      return errors.notFound("Version not found");
    }

    return NextResponse.json(version);
  } catch (error) {
    console.error("Version GET error:", error);
    return errors.serverError();
  }
}
