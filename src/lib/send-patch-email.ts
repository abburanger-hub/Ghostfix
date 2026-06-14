// =============================================================================
// GhostFix — Resend Email Utility
//
// Sends transactional emails via Resend (https://resend.com).
// Non-throwing — email failures are logged but never break the pipeline.
//
// Setup:
//   1. Sign up at resend.com (free: 3,000 emails/month)
//   2. Add RESEND_API_KEY to your Vercel environment variables
//   3. (Optional) Verify a custom domain and set RESEND_FROM
//      Default sender: GhostFix <onboarding@resend.dev>  (sandbox — delivers
//      only to the account owner's email; fine for hackathon demos)
// =============================================================================

import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Shared HTML helpers
// ---------------------------------------------------------------------------

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GhostFix Notification</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e4e4e7;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#18181b;border-radius:16px 16px 0 0;border:1px solid #27272a;border-bottom:0;padding:28px 32px 20px;">
              <span style="font-size:26px;line-height:1;">👻</span>
              <span style="font-size:18px;font-weight:700;color:#ffffff;margin-left:8px;vertical-align:middle;letter-spacing:-0.02em;">GhostFix</span>
              <p style="margin:12px 0 0;font-size:11px;color:#52525b;letter-spacing:0.08em;text-transform:uppercase;">Automated Triage Notification</p>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background:#18181b;border-left:1px solid #27272a;border-right:1px solid #27272a;padding:0 32px 32px;">
              ${content}
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#18181b;border-radius:0 0 16px 16px;border:1px solid #27272a;border-top:1px solid #27272a;padding:18px 32px;">
              <p style="margin:0;font-size:12px;color:#52525b;line-height:1.6;">
                Sent by <a href="https://ghostfix.vercel.app" style="color:#6366f1;text-decoration:none;">GhostFix</a>
                &nbsp;·&nbsp; You received this because you submitted a bug report.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function infoCard(label: string, value: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:12px;">
    <tr>
      <td style="background:#09090b;border-radius:8px;border:1px solid #27272a;padding:14px 18px;">
        <p style="margin:0 0 3px;font-size:10px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.08em;">${label}</p>
        <p style="margin:0;font-size:13px;color:#e4e4e7;line-height:1.5;">${value}</p>
      </td>
    </tr>
  </table>`;
}

// ---------------------------------------------------------------------------
// Email 1 — Patch ready (ghost environment provisioned)
// ---------------------------------------------------------------------------

interface PatchReadyOptions {
  to: string;
  ticketId: string;
  failingModule: string;
  fixSummary: string;
  ghostLink: string;
}

export async function sendPatchReadyEmail(opts: PatchReadyOptions): Promise<void> {
  const { to, ticketId, failingModule, fixSummary, ghostLink } = opts;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes("placeholder") || apiKey === "re_your_key_here") {
    console.warn("[GhostFix] RESEND_API_KEY not configured — skipping patch-ready email");
    return;
  }

  const body = `
    <h1 style="margin:24px 0 8px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.2;">
      Your patch is ready ✓
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      GhostFix has analysed your bug report and deployed an isolated hotfix environment.
      You can test the fix right now — no setup required.
    </p>

    ${infoCard("Affected Module", failingModule)}
    ${infoCard("Fix Applied", fixSummary)}
    ${infoCard("Ticket ID", `#${ticketId.slice(0, 8).toUpperCase()}`)}

    <!-- CTA button -->
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 20px;">
      <tr>
        <td style="background:#6366f1;border-radius:10px;">
          <a href="${ghostLink}"
             style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
            Open Ghost Environment &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:11px;color:#52525b;line-height:1.8;word-break:break-all;">
      Or copy this URL:<br />
      <span style="font-family:'Courier New',monospace;color:#71717a;">${ghostLink}</span>
    </p>

    <p style="margin:24px 0 0;font-size:12px;color:#52525b;border-top:1px solid #27272a;padding-top:18px;">
      This isolated environment proves the hotfix is live. Your engineering team has also
      been notified and is reviewing the generated patch.
    </p>
  `;

  try {
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM ?? "GhostFix <onboarding@resend.dev>";

    const { error } = await resend.emails.send({
      from,
      to,
      subject: `✓ GhostFix: patch ready for ${failingModule}`,
      html: baseLayout(body),
    });

    if (error) {
      console.warn("[GhostFix] Resend patch-ready email error:", error.message);
    } else {
      console.log(`[GhostFix] Patch-ready email sent → ${to}`);
    }
  } catch (err) {
    // Never let email failure break the pipeline
    console.warn("[GhostFix] sendPatchReadyEmail threw:", err);
  }
}

// ---------------------------------------------------------------------------
// Email 2 — Ticket escalated (human review required)
// ---------------------------------------------------------------------------

interface EscalationOptions {
  to: string;
  ticketId: string;
  failingModule: string;
  fixSummary: string;
}

export async function sendEscalationEmail(opts: EscalationOptions): Promise<void> {
  const { to, ticketId, failingModule, fixSummary } = opts;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes("placeholder") || apiKey === "re_your_key_here") {
    console.warn("[GhostFix] RESEND_API_KEY not configured — skipping escalation email");
    return;
  }

  const body = `
    <h1 style="margin:24px 0 8px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.2;">
      Your ticket has been escalated
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      GhostFix analysed your bug report but the confidence score was too low for
      an automated patch. Your ticket has been escalated to the engineering team
      for manual review.
    </p>

    ${infoCard("Affected Module", failingModule)}
    ${infoCard("AI Diagnosis", fixSummary)}
    ${infoCard("Ticket ID", `#${ticketId.slice(0, 8).toUpperCase()}`)}
    ${infoCard("Status", "Escalated — awaiting engineer review")}

    <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa;line-height:1.7;">
      Your engineering team can review the full AI triage report and post a resolution
      note on the
      <a href="https://ghostfix.vercel.app/escalate/${ticketId}"
         style="color:#6366f1;text-decoration:none;">escalation page</a>.
      You will receive another email once the ticket is resolved.
    </p>

    <p style="margin:24px 0 0;font-size:12px;color:#52525b;border-top:1px solid #27272a;padding-top:18px;">
      Typical resolution time is under 2 hours during business hours.
    </p>
  `;

  try {
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM ?? "GhostFix <onboarding@resend.dev>";

    const { error } = await resend.emails.send({
      from,
      to,
      subject: `⚠️ GhostFix: ticket escalated — ${failingModule}`,
      html: baseLayout(body),
    });

    if (error) {
      console.warn("[GhostFix] Resend escalation email error:", error.message);
    } else {
      console.log(`[GhostFix] Escalation email sent → ${to}`);
    }
  } catch (err) {
    console.warn("[GhostFix] sendEscalationEmail threw:", err);
  }
}
