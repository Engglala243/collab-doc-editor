import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/api-response";
import { canEdit, canManage, canView, resolveRole } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ documentId: string }> };

async function getDocumentWithRole(documentId: string, userId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      members: { where: { userId }, select: { role: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  if (!document) return null;

  const role = resolveRole(document.ownerId, userId, document.members[0]?.role);
  return { document, role };
}

// GET /api/documents/:documentId
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const { documentId } = await params;
  const result = await getDocumentWithRole(documentId, session.user.id);

  if (!result) return errors.notFound("Document");
  if (!canView(result.role)) return errors.forbidden();

  return apiSuccess({ document: result.document, role: result.role });
}

// PATCH /api/documents/:documentId
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const { documentId } = await params;
  const result = await getDocumentWithRole(documentId, session.user.id);

  if (!result) return errors.notFound("Document");
  if (!canEdit(result.role)) return errors.forbidden();

  try {
    const body = await req.json();
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      content: z.string().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.content !== undefined && { content: parsed.data.content as Prisma.InputJsonValue }),
      },
    });

    return apiSuccess({ document: updated });
  } catch {
    return errors.serverError();
  }
}

// DELETE /api/documents/:documentId
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const { documentId } = await params;
  const result = await getDocumentWithRole(documentId, session.user.id);

  if (!result) return errors.notFound("Document");
  if (!canManage(result.role)) return errors.forbidden();

  await prisma.document.delete({ where: { id: documentId } });

  return apiSuccess({ success: true });
}
