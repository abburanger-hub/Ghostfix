"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Shield, ChevronDown, User } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface UserMenuProps {
  email: string;
  isAdmin: boolean;
}

export function UserMenu({ email, isAdmin }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-user-menu]")) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = email[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative" data-user-menu="">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 py-1.5 pl-1.5 pr-3 text-xs transition-colors hover:bg-muted/40"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-300">
          {initials}
        </span>
        <span className="hidden max-w-[120px] truncate text-muted-foreground sm:block">
          {email}
        </span>
        {isAdmin && (
          <span title="Admin">
            <Shield className="size-3 text-amber-400" />
          </span>
        )}
        <ChevronDown className="size-3 text-muted-foreground/60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-border/50 bg-card shadow-xl shadow-black/20 backdrop-blur-sm">
          {/* User info */}
          <div className="border-b border-border/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <User className="size-3.5 shrink-0 text-muted-foreground/50" />
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            {isAdmin && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <Shield className="size-3 text-amber-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  Admin
                </span>
              </div>
            )}
          </div>

          {/* Sign out */}
          <div className="p-1.5">
            <button
              onClick={signOut}
              disabled={loading}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-red-500/8 hover:text-red-400"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
