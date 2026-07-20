"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RiFileList3Fill } from "react-icons/ri";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#e60000] mb-4 shadow-lg shadow-[#e60000]/20">
            <RiFileList3Fill className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-[28px] font-bold text-white tracking-tight">CollabDocs</h1>
          <p className="text-[#a1a1aa] text-[15px] mt-1.5">Sign in to your account</p>
        </div>

        <Card className="sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <Button
              id="login-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-2"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-[#a1a1aa] text-[15px] mt-8">
            No account?{" "}
            <Link href="/register" className="text-[#e60000] hover:text-[#cc0000] font-medium transition-colors">
              Create one
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
