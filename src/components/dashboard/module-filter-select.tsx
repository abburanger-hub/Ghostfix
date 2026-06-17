"use client";

// Client component — auto-submits a form when the module dropdown changes.
// Mirrors TeamFilterSelect but filters by `failing_module` column.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Cpu } from "lucide-react";

interface Props {
  modules: string[];
  defaultValue?: string;
  isAdmin?: boolean;
}

export function ModuleFilterSelect({ modules, defaultValue = "", isAdmin = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("module", e.target.value);
    } else {
      params.delete("module");
    }
    // Reset to page 1 when filter changes
    params.delete("page");
    startTransition(() => router.push(`/dashboard?${params.toString()}`));
  }

  const accentCls = isAdmin
    ? "border-violet-500/30 bg-violet-500/10 text-violet-300 focus-visible:border-violet-400"
    : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 focus-visible:border-indigo-400";

  return (
    <div className="flex items-center gap-1.5">
      <Cpu className={`size-3 shrink-0 ${isAdmin ? "text-violet-400" : "text-indigo-400"}`} />
      <select
        value={defaultValue}
        onChange={handleChange}
        disabled={isPending}
        className={`h-8 rounded-lg border px-2.5 text-xs font-medium outline-none transition-colors disabled:opacity-60 ${accentCls}`}
      >
        <option value="" className="bg-card text-foreground">All modules</option>
        {modules.map((m) => (
          <option key={m} value={m} className="bg-card text-foreground">{m}</option>
        ))}
      </select>
    </div>
  );
}
