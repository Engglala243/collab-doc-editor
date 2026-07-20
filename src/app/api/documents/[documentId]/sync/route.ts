import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/api-response";
import { canEdit, canView, resolveRole } from "@/lib/permissions";
import { syncLimiter } from "@/lib/middleware/rate-limiter";
import {
  checkContentLength,
  validateSyncUpdates,
  SYNC_BODY_MAX_BYTES,
} from "@/lib/middleware/body-guard";

type Params = { params: Promise<{ documentId: string }> };

/** Max remote updates returned per sync call — prevents huge payloads on first sync */
const PULL_PAGE_SIZE = 100;

const SyncSchema = z.object({
  clientId: z.string().min(1).max(128),
  serverSequence: z.number().nonnegative().int(),
  updates: z.array(
    z.object({
      id: z.string().min(1).max(128),
      sequence: z.number().nonnegative().int(),
      payload: z.string(), // base64 — deep-validated by body-guard
    })
  ).max(50),
});

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  // ─── Rate limiting ──────────────────────────────────────────────────────────
  const rl = syncLimiter.check(session.user.id);
  if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter);

  // ─── Body size guard ────────────────────────────────────────────────────────
  const sizeError = checkContentLength(req, SYNC_BODY_MAX_BYTES);
  if (sizeError) return sizeError;

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

  // ─── Deep payload validation (malformed binary rejection) ───────────────────
  if (updates.length > 0) {
    const payloadError = validateSyncUpdates(updates);
    if (payloadError) {
      return errors.badRequest(payloadError.reason);
    }
  }

  // ─── 1. Store incoming updates idempotently ─────────────────────────────────
  const acknowledgedIds: string[] = [];
  if (updates.length > 0) {
    try {
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

  // ─── 2. Fetch remote updates (paginated) ────────────────────────────────────
  const remoteUpdates = await prisma.documentUpdate.findMany({
    where: {
      documentId,
      serverSequence: { gt: serverSequence },
      clientId: { not: clientId },
    },
    orderBy: { serverSequence: "asc" },
    take: PULL_PAGE_SIZE,
  });

  let maxServerSequence = serverSequence;
  if (remoteUpdates.length > 0) {
    maxServerSequence = Math.max(...remoteUpdates.map((u) => u.serverSequence));
  }

  // Check if the client's own pushes moved sequence forward
  const latestDocUpdate = await prisma.documentUpdate.findFirst({
    where: { documentId },
    orderBy: { serverSequence: "desc" },
    select: { serverSequence: true },
  });

  if (latestDocUpdate && latestDocUpdate.serverSequence > maxServerSequence) {
    maxServerSequence = latestDocUpdate.serverSequence;
  }

  // hasMore tells the client to re-poll immediately for the next page
  const hasMore = remoteUpdates.length === PULL_PAGE_SIZE;

  return apiSuccess({
    acknowledgedIds,
    serverSequence: maxServerSequence,
    hasMore,
    remoteUpdates: remoteUpdates.map((u) => ({
      clientId: u.clientId,
      sequence: u.sequence,
      serverSequence: u.serverSequence,
      payload: u.payload,
    })),
  });
}

