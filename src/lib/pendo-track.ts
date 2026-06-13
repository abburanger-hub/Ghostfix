// =============================================================================
// GhostFix — Pendo Server-Side Track Event Utility
//
// Sends track events to the Pendo Data API via HTTP POST from any server-side
// context (API routes, Server Components, etc.) where the browser SDK is not
// available. Uses the Pendo Track API integration key.
//
// Usage:
//   import { pendoTrack } from "@/lib/pendo-track";
//   await pendoTrack({ event: "ticket_ingested", visitorId: userEmail, properties: { ... } });
// =============================================================================

const PENDO_TRACK_URL = "https://data.pendo.io/data/track";
const PENDO_INTEGRATION_KEY = "bd86a3ed-f3d6-4f7b-a591-387024d3d19c";

export interface PendoTrackOptions {
  /** Name of the event (snake_case) */
  event: string;
  /** Visitor ID — use user_email for identified users, "system" for pipeline events */
  visitorId: string;
  /** Account ID — defaults to "ghostfix" */
  accountId?: string;
  /** Arbitrary event properties (strings, numbers, booleans only) */
  properties?: Record<string, string | number | boolean>;
}

/**
 * pendoTrack — fire a server-side track event to Pendo Data API.
 *
 * Non-throwing: logs errors to console but never rejects, so a Pendo
 * outage cannot break the ticket pipeline.
 */
export async function pendoTrack({
  event,
  visitorId,
  accountId = "ghostfix",
  properties = {},
}: PendoTrackOptions): Promise<void> {
  try {
    await fetch(PENDO_TRACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pendo-integration-key": PENDO_INTEGRATION_KEY,
      },
      body: JSON.stringify({
        type: "track",
        event,
        visitorId,
        accountId,
        timestamp: Date.now(),
        properties,
      }),
    });
  } catch (err) {
    // Non-fatal — Pendo unavailability must never break the pipeline
    console.error("[Pendo] Server-side track failed:", event, err);
  }
}
