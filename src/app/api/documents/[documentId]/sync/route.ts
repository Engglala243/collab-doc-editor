import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/api-response";
import { canEdit, canView, resolveRole } from "@/lib/permissions";

type Params = { params: Promise<{ documentId: string }> };

const SyncSchema = z.object({
  clientId: z.string(),
  serverSequence: z.number().nonnegative(),
  updates: z.array(
    z.object({
      id: z.string(),
      sequence: z.number().nonnegative(),
      payload: z.string(), // base64
    })
  ),
});

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const { documentId } = await params;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      members: { where: { userId: session.user.id }, select: { role: true } },
    },
  });

  if (!document) return errors.notFound("Document");

  const role = resolveRole(document.ownerId, session.user.id, document.members[0]?.role);
  if (!canView(role)) return errors.forbidden();

  const body = await req.json();
  const parsed = SyncSchema.safeParse(body);
  if (!parsed.success) {
    return errors.badRequest("Invalid sync payload");
  }

  const { clientId, serverSequence, updates } = parsed.data;

  // Only editors/owners can push updates. Viewers can only pull (empty updates array).
  if (updates.length > 0 && !canEdit(role)) {
    return errors.forbidden();
  }

  // 1. Store incoming updates idempotently
  const acknowledgedIds: string[] = [];
  if (updates.length > 0) {
    try {
      // Prisma createMany with skipDuplicates ensures idempotency for (documentId, clientId, sequence)
      await prisma.documentUpdate.createMany({
        data: updates.map((u) => ({
          id: u.id,
          documentId,
          clientId,
          sequence: u.sequence,
          payload: u.payload,
        })),
        skipDuplicates: true,
      });

      acknowledgedIds.push(...updates.map((u) => u.id));
    } catch (e) {
      console.error("Failed to store sync updates:", e);
      return errors.serverError();
    }
  }

  // 2. Fetch remote updates that this client hasn't seen yet
  // We fetch updates strictly greater than the client's last seen serverSequence
  const remoteUpdates = await prisma.documentUpdate.findMany({
    where: {
      documentId,
      serverSequence: { gt: serverSequence },
      clientId: { not: clientId }, // Don't send the client their own updates back
    },
    orderBy: { serverSequence: "asc" },
  });

  // Determine the new highest serverSequence to return to the client
  let maxServerSequence = serverSequence;
  if (remoteUpdates.length > 0) {
    maxServerSequence = Math.max(...remoteUpdates.map((u) => u.serverSequence));
  }
  
  // Also check if our own freshly inserted updates pushed the sequence higher,
  // so the client knows what sequence they are up to.
  const latestDocUpdate = await prisma.documentUpdate.findFirst({
    where: { documentId },
    orderBy: { serverSequence: "desc" },
    select: { serverSequence: true },
  });

  if (latestDocUpdate && latestDocUpdate.serverSequence > maxServerSequence) {
    maxServerSequence = latestDocUpdate.serverSequence;
  }

  return apiSuccess({
    acknowledgedIds,
    serverSequence: maxServerSequence,
    remoteUpdates: remoteUpdates.map((u) => ({
      clientId: u.clientId,
      sequence: u.sequence,
      serverSequence: u.serverSequence,
      payload: u.payload,
    })),
  });
}
