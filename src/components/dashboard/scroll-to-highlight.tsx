"use client";

// Smooth-scrolls the highlighted ticket row into view after the
// dashboard navigates to /dashboard?highlight=[id].
// Rendered as an invisible client component inside the Server Component page.

import { useEffect } from "react";

export default function ScrollToHighlight({ ticketId }: { ticketId?: string }) {
  useEffect(() => {
    if (!ticketId) return;
    const el = document.getElementById("highlighted-ticket");
    if (el) {
      // Small delay so the animation has time to start
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
    }
  }, [ticketId]);

  return null;
}
