import { z } from "zod";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/api-response";
import { apiLimiter } from "@/lib/middleware/rate-limiter";

const createDocSchema = z.object({
  title: z.string().min(1).max(200),
});

const PAGE_SIZE = 20;

// GET /api/documents — list all documents for the current user (cursor paginated)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  // Rate limiting
  const rl = apiLimiter.check(session.user.id);
  if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter);

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10), 100);

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1, // fetch one extra to determine hasMore
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

  const hasMore = documents.length > limit;
  const page = hasMore ? documents.slice(0, limit) : documents;
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;

  const result = page.map((doc) => ({
    id: doc.id,
    title: doc.title,
    owner: doc.owner,
    role: doc.ownerId === userId ? "OWNER" : (doc.members[0]?.role ?? "VIEWER"),
    memberCount: doc._count.members,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  return apiSuccess({ documents: result, nextCursor, hasMore });
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
