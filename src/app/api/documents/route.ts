import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/api-response";

const createDocSchema = z.object({
  title: z.string().min(1).max(200),
});

// GET /api/documents — list all documents for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const userId = session.user.id;

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      members: {
        where: { userId },
        select: { role: true },
      },
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    owner: doc.owner,
    role: doc.ownerId === userId ? "OWNER" : (doc.members[0]?.role ?? "VIEWER"),
    memberCount: doc._count.members,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  return apiSuccess({ documents: result });
}

// POST /api/documents — create a new document
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const userId = session.user.id;

  try {
    const body = await req.json();
    const parsed = createDocSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const document = await prisma.document.create({
      data: {
        title: parsed.data.title,
        content: {},
        ownerId: userId,
        members: {
          create: { userId, role: "OWNER" },
        },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return apiSuccess({ document: { ...document, role: "OWNER" } }, 201);
  } catch {
    return errors.serverError();
  }
}
