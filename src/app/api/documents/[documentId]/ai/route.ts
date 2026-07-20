import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveRole } from "@/lib/permissions";
import { errors, apiSuccess } from "@/lib/api-response";
import { aiLimiter } from "@/lib/middleware/rate-limiter";
import { checkContentLength } from "@/lib/middleware/body-guard";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/env";
import { z } from "zod";

const AI_TEXT_MAX_BYTES = 32 * 1024; // 32KB max input text

const AiSchema = z.object({
  action: z.enum(["summarize", "rewrite"]),
  text: z.string().min(10).max(20000),
  instruction: z.string().max(500).optional(), // Optional custom instruction for rewrite
});

const PROMPTS = {
  summarize: (text: string) =>
    `You are a concise document assistant. Summarize the following document content in 3-5 bullet points. Be clear, direct, and preserve key information.\n\nDocument:\n${text}\n\nSummary:`,
  rewrite: (text: string, instruction?: string) =>
    `You are a professional writing assistant. Rewrite the following text${instruction ? ` with this instruction: "${instruction}"` : " to be clearer, more professional, and well-structured"}. Return ONLY the rewritten text, no explanations.\n\nOriginal:\n${text}\n\nRewritten:`,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  // Rate limit: 5 AI calls per user per minute
  const rl = aiLimiter.check(session.user.id);
  if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter);

  // Body size guard
  const sizeError = checkContentLength(req, AI_TEXT_MAX_BYTES);
  if (sizeError) return sizeError;

  const { documentId } = await params;

  // Verify the user has access to this document
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { members: { where: { userId: session.user.id } } },
  });

  if (!document) return errors.notFound("Document");

  const role = resolveRole(document.ownerId, session.user.id, document.members[0]?.role);
  if (!role) return errors.forbidden();

  const body = await req.json();
  const parsed = AiSchema.safeParse(body);
  if (!parsed.success) {
    return errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  if (!env.GEMINI_API_KEY) {
    return errors.badRequest("AI features are not configured on this server");
  }

  const { action, text, instruction } = parsed.data;

  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL ?? "gemini-1.5-flash",
    });

    const prompt = action === "summarize"
      ? PROMPTS.summarize(text)
      : PROMPTS.rewrite(text, instruction);

    const result = await model.generateContent(prompt);
    const output = result.response.text().trim();

    return apiSuccess({
      action,
      result: output,
      inputLength: text.length,
    });
  } catch (err) {
    console.error("[AI Route] Gemini error:", err);
    return errors.serverError();
  }
}
