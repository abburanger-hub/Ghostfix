"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Ghost, Mail, Lock, Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createBrowserSupabaseClient();

  // If already logged in, redirect
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(next);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 shadow-xl shadow-indigo-500/30">
            <Ghost className="size-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="bg-gradient-to-r from-indigo-300 via-purple-300 to-violet-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              GhostFix
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                  className="h-10 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-10 w-full rounded-lg border border-input bg-transparent pl-9 pr-10 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-10 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Sign In
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-indigo-400 hover:text-indigo-300">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
