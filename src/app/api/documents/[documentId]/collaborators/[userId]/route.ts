import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/api-response";
import { canManage, resolveRole } from "@/lib/permissions";

type Params = { params: Promise<{ documentId: string; userId: string }> };

// PATCH /api/documents/:documentId/collaborators/:userId — update role
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const { documentId, userId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { members: { where: { userId: session.user.id }, select: { role: true } } },
  });

  if (!document) return errors.notFound("Document");

  const role = resolveRole(document.ownerId, session.user.id, document.members[0]?.role);
  if (!canManage(role)) return errors.forbidden();
  if (userId === document.ownerId) return errors.badRequest("Cannot change owner role");

  try {
    const body = await req.json();
    const schema = z.object({ role: z.enum(["EDITOR", "VIEWER"]) });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return errors.badRequest("Invalid role");

    const updated = await prisma.documentMember.update({
      where: { documentId_userId: { documentId, userId } },
      data: { role: parsed.data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return apiSuccess({ member: updated });
  } catch {
    return errors.serverError();
  }
}

// DELETE /api/documents/:documentId/collaborators/:userId — remove member
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const { documentId, userId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { members: { where: { userId: session.user.id }, select: { role: true } } },
  });

  if (!document) return errors.notFound("Document");

  const role = resolveRole(document.ownerId, session.user.id, document.members[0]?.role);
  if (!canManage(role)) return errors.forbidden();
  if (userId === document.ownerId) return errors.badRequest("Cannot remove owner");

  await prisma.documentMember.delete({
    where: { documentId_userId: { documentId, userId } },
  });

  return apiSuccess({ success: true });
}
