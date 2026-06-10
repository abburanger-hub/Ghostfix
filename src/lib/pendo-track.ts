// =============================================================================
// Pendo Server-Side Track Event Utility
// Sends track events to the Pendo data API via HTTP POST.
// =============================================================================

const PENDO_TRACK_URL = "https://data.pendo.io/data/track";
const PENDO_INTEGRATION_KEY = "bd86a3ed-f3d6-4f7b-a591-387024d3d19c";

interface PendoTrackOptions {
  event: string;
  visitorId: string;
  accountId?: string;
  properties?: Record<string, string | number | boolean>;
}

export async function pendoTrack({
  event,
  visitorId,
  accountId = "system",
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
    console.error("[Pendo] Track event failed:", event, err);
  }
}
