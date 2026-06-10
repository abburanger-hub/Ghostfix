"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justRefreshed, setJustRefreshed] = useState(false);

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
    setJustRefreshed(true);
    setTimeout(() => setJustRefreshed(false), 1500);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-border hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
    >
      <RefreshCw
        className={`size-3 transition-transform ${isPending ? "animate-spin" : ""}`}
      />
      {justRefreshed && !isPending ? "Updated" : "Refresh"}
    </button>
  );
}
