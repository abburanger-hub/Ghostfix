"use client";

// =============================================================================
// GhostFix — Novus Dashboard Tracker
// Client component that fires the dashboard_data_loaded track event when the
// Triage Command Center mounts. Renders nothing visible.
// =============================================================================

import { useEffect } from "react";

interface DashboardTrackerProps {
  total: number;
  patched: number;
  inPipeline: number;
  escalated: number;
  patchRate: number;
  isDemo: boolean;
}

export default function PendoDashboardTracker(props: DashboardTrackerProps) {
  useEffect(() => {
    if (typeof pendo !== "undefined") {
      pendo.track("dashboard_data_loaded", props);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
