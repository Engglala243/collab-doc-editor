import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveRole } from "@/lib/permissions";
import { Editor } from "@/components/editor/Editor";
import { ShareModal } from "@/components/editor/ShareModal";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { RiLock2Fill } from "react-icons/ri";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { documentId } = await params;

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
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4">
        <Card className="text-center p-12 max-w-md w-full">
          <div className="w-16 h-16 bg-[#e60000]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#e60000]/10">
            <RiLock2Fill className="w-8 h-8 text-[#e60000]" />
          </div>
          <h1 className="text-[24px] font-bold text-white tracking-tight mb-2">Access Denied</h1>
          <p className="text-[#a1a1aa] text-[15px]">You don&apos;t have permission to view or edit this document.</p>
        </Card>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-8 px-6">
        <Card className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
          <div>
            <h1 className="text-[28px] font-bold text-white tracking-tight">{document.title}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className={`text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-md border font-bold ${
                role === "OWNER" ? "bg-[#e60000]/10 text-[#e60000] border-[#e60000]/20" :
                role === "EDITOR" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                "bg-[#262626] text-[#a1a1aa] border-[#404040]"
              }`}>
                {role}
              </span>
            </div>
          </div>
          {role === "OWNER" && (
            <ShareModal documentId={documentId} />
          )}
        </Card>
      
        <div className="bg-[#171717] border border-[#262626] rounded-3xl overflow-hidden min-h-[70vh] shadow-xl">
          <Editor 
            documentId={documentId} 
            currentUser={{
              id: session.user.id,
              name: session.user.name || "Anonymous",
              role
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
}
