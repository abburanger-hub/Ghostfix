"use client";

import { useRef } from "react";
import { Users } from "lucide-react";

interface Team { id: string; name: string }

interface TeamFilterSelectProps {
  teams: Team[];
  defaultValue: string;
}

export function TeamFilterSelect({ teams, defaultValue }: TeamFilterSelectProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="GET" action="/dashboard" className="flex items-center gap-2">
      <Users className="size-3.5 shrink-0 text-violet-400/70" />
      <select
        name="team"
        defaultValue={defaultValue}
        onChange={() => formRef.current?.submit()}
        className="h-8 cursor-pointer rounded-lg border border-violet-500/25 bg-zinc-900 px-2.5 text-xs text-violet-300 outline-none transition-colors hover:border-violet-500/40 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
      >
        <option value="" className="bg-zinc-900 text-zinc-200">All teams</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id} className="bg-zinc-900 text-zinc-200">
            {t.name}
          </option>
        ))}
      </select>
    </form>
  );
}
