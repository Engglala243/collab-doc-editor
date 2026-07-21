"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RiShareLine, RiCloseLine, RiUserUnfollowLine, RiArrowDownSLine } from "react-icons/ri";

type Member = {
  id: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  user: { id: string; name: string; email: string };
};

// Custom Select Component to avoid native browser blue highlight styles
function RoleSelect({ 
  value, 
  onChange, 
  className = "",
  size = "normal"
}: { 
  value: "EDITOR" | "VIEWER", 
  onChange: (v: "EDITOR" | "VIEWER") => void, 
  className?: string,
  size?: "small" | "normal"
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        // Also check if the click was inside the portal dropdown
        const portalEl = document.getElementById("dropdown-portal-root");
        if (portalEl && portalEl.contains(event.target as Node)) {
          return;
        }
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setOpen(!open);
  };

  const isSmall = size === "small";

  return (
    <div className={`relative min-w-[100px] ${className}`} ref={ref}>
      <div 
        data-testid="role-trigger"
        className={`flex justify-between items-center bg-[#262626] border border-[#404040]/50 text-white cursor-pointer transition-colors hover:border-[#737373] ${
          isSmall ? "px-2.5 py-1.5 text-[12px] rounded-lg" : "px-4 py-2.5 text-[14px] rounded-xl"
        }`}
        onClick={handleToggle}
      >
        <span className="capitalize font-medium">{value.toLowerCase()}</span>
        <RiArrowDownSLine className={`w-4 h-4 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && createPortal(
        <div id="dropdown-portal-root">
          <div 
            style={{ 
              position: 'absolute', 
              top: coords.top + 4, 
              left: coords.left, 
              width: coords.width 
            }}
            className="bg-[#262626] border border-[#404040] rounded-xl overflow-hidden z-[9999] shadow-xl shadow-black/50"
          >
            {(["EDITOR", "VIEWER"] as const).map(opt => (
              <div 
                key={opt}
                data-testid={`role-option-${opt.toLowerCase()}`}
                className={`cursor-pointer transition-colors flex items-center ${
                  isSmall ? "px-3 py-2 text-[12px]" : "px-4 py-2.5 text-[14px]"
                } ${
                  value === opt 
                    ? 'bg-[#e60000] text-white font-medium' 
                    : 'text-[#a1a1aa] hover:bg-[#333333] hover:text-white'
                }`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                <span className="capitalize">{opt.toLowerCase()}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function ShareModal({ documentId }: { documentId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function fetchMembers() {
    const res = await fetch(`/api/documents/${documentId}/collaborators`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members || []);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/documents/${documentId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    const data = await res.json();

    if (res.ok) {
      setSuccess("User invited successfully!");
      setEmail("");
      fetchMembers();
    } else {
      setError(data.message || "Failed to invite user");
    }
    setLoading(false);
  }

  async function handleUpdateRole(userId: string, newRole: "EDITOR" | "VIEWER") {
    const res = await fetch(`/api/documents/${documentId}/collaborators/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) fetchMembers();
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Are you sure you want to remove this collaborator?")) return;
    const res = await fetch(`/api/documents/${documentId}/collaborators/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) fetchMembers();
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[#e60000] hover:bg-[#cc0000] text-white text-[14px] font-semibold rounded-xl transition-colors"
      >
        <RiShareLine className="w-4 h-4" />
        Share
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#171717] border border-[#262626] rounded-3xl p-6 shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[20px] font-bold text-white tracking-tight">Share Document</h2>
              <button onClick={() => setIsOpen(false)} className="text-[#a1a1aa] hover:text-white hover:bg-[#262626] p-2 rounded-full transition-colors">
                <RiCloseLine className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="mb-6 flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="User's email address..."
                required
                className="flex-1 px-4 py-2.5 bg-[#262626] border border-[#404040]/50 rounded-xl text-white text-[14px] placeholder-[#737373] focus:outline-none focus:border-[#e60000] transition-colors"
              />
              <RoleSelect 
                value={role} 
                onChange={setRole} 
              />
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-[#e60000] hover:bg-[#cc0000] disabled:opacity-50 text-white text-[14px] font-semibold rounded-xl transition-colors"
              >
                {loading ? "..." : "Invite"}
              </button>
            </form>

            {error && <p className="text-red-400 text-[13px] mb-4 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{error}</p>}
            {success && <p className="text-green-400 text-[13px] mb-4 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20">{success}</p>}

            <div>
              <h3 className="text-[14px] font-semibold text-[#a1a1aa] mb-3">Collaborators</h3>
              {members.length === 0 ? (
                <p className="text-[13px] text-[#737373] text-center py-4">No collaborators yet.</p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {members.map((m) => (
                    <div key={m.id} data-testid={`collaborator-row-${m.user.email}`} className="flex justify-between items-center bg-[#262626]/50 p-3 rounded-xl border border-[#404040]/50">
                      <div>
                        <p className="text-[14px] text-white font-medium">{m.user.name}</p>
                        <p className="text-[12px] text-[#a1a1aa]">{m.user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.role === "OWNER" ? (
                          <span className="text-[11px] uppercase tracking-wider px-2 py-1 text-[#a1a1aa] font-bold">Owner</span>
                        ) : (
                          <>
                            <RoleSelect 
                              value={m.role} 
                              onChange={(newRole) => handleUpdateRole(m.user.id, newRole)}
                              size="small"
                            />
                            <button
                              onClick={() => handleRemoveMember(m.user.id)}
                              className="text-[#737373] hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-[#262626]"
                              title="Remove access"
                            >
                              <RiUserUnfollowLine className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
