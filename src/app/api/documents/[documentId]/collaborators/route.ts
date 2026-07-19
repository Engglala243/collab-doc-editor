import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/api-response";
import { canManage, resolveRole } from "@/lib/permissions";

type Params = { params: Promise<{ documentId: string }> };

// POST /api/documents/:documentId/collaborators — add a collaborator
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const { documentId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { members: { where: { userId: session.user.id }, select: { role: true } } },
  });

  if (!document) return errors.notFound("Document");

  const role = resolveRole(document.ownerId, session.user.id, document.members[0]?.role);
  if (!canManage(role)) return errors.forbidden();

  try {
    const body = await req.json();
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(["EDITOR", "VIEWER"]),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) return errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid");

    const targetUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, name: true, email: true },
    });

    if (!targetUser) return errors.notFound("User");
    if (targetUser.id === session.user.id) return errors.badRequest("Cannot add yourself");

    const member = await prisma.documentMember.upsert({
      where: { documentId_userId: { documentId, userId: targetUser.id } },
      create: { documentId, userId: targetUser.id, role: parsed.data.role },
      update: { role: parsed.data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return apiSuccess({ member }, 201);
  } catch {
    return errors.serverError();
  }
}

// GET /api/documents/:documentId/collaborators — list all members
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const { documentId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { members: { where: { userId: session.user.id }, select: { role: true } } },
  });

  if (!document) return errors.notFound("Document");

  const role = resolveRole(document.ownerId, session.user.id, document.members[0]?.role);
  if (!canManage(role)) return errors.forbidden();

  const members = await prisma.documentMember.findMany({
    where: { documentId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess({ members });
}
