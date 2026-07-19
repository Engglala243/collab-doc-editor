import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveRole } from "@/lib/permissions";
import { Editor } from "@/components/editor/Editor";

export default async function DocumentPage({
  params,
}: {
  params: { documentId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { documentId } = params;

  // Fetch document and user's role
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      members: {
        where: { userId: session.user.id },
      },
    },
  });

  if (!document) {
    notFound();
  }

  const memberRole = document.members[0]?.role ?? null;
  const role = resolveRole(document.ownerId, session.user.id, memberRole);

  if (!role) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-slate-500">You don&apos;t have permission to view this document.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{document.title}</h1>
          <p className="text-sm text-slate-500">Role: {role}</p>
        </div>
      </div>
      
      <Editor documentId={documentId} />
    </div>
  );
}
