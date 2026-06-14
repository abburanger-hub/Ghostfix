"use client";

// =============================================================================
// GhostFix — Pendo Navigation Tracker
//
// Fires pendo.pageLoad() on every client-side route change in Next.js App
// Router. Without this, only the very first hard-load triggers a Pendo page
// view; all subsequent <Link> navigations are invisible to the analytics agent.
// =============================================================================

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function PendoNavigationTracker() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the very first render — pendo.initialize() already fires the initial
    // page view when the agent loads. Only fire pageLoad() for navigations.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (typeof pendo !== "undefined" && typeof pendo.pageLoad === "function") {
      pendo.pageLoad();
    }
  }, [pathname]);

  return null;
}
