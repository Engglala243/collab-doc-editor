"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { RiFileList3Fill } from "react-icons/ri";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Registration failed");
        setLoading(false);
        return;
      }

      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#e60000] mb-4 shadow-lg shadow-[#e60000]/20">
            <RiFileList3Fill className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-[28px] font-bold text-white tracking-tight">Create an account</h1>
          <p className="text-[#a1a1aa] text-[15px] mt-1.5">Join CollabDocs today</p>
        </div>

        <Card className="sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

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
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <Button
              id="register-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-2"
            >
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </form>

          <p className="text-center text-[#a1a1aa] text-[15px] mt-8">
            Already have an account?{" "}
            <Link href="/login" className="text-[#e60000] hover:text-[#cc0000] font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
