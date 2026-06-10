import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GhostFix | Autonomous SRE Triage Agent",
  description:
    "AI-powered bug triage that instantly spins up hotfix environments, so your users are never blocked.",
  keywords: ["SRE", "bug triage", "autonomous", "hotfix", "product ops"],
  openGraph: {
    title: "GhostFix | Autonomous SRE Triage Agent",
    description:
      "Submit a bug. Get a working hotfix environment in seconds — not days.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        {/*
         * ============================================================
         *  NOVUS.AI OBSERVABILITY SCRIPT — INJECT HERE
         * ============================================================
         *  1. Sign up / log in at: https://novus.pendo.io
         *  2. Create a new application in your Novus dashboard.
         *  3. Copy the generated initialization snippet.
         *  4. Uncomment the <Script> block below and paste your
         *     snippet inside dangerouslySetInnerHTML.__html.
         *
         *  strategy="afterInteractive" ensures Novus loads after
         *  React hydration — recommended for Next.js App Router.
         * ============================================================
         */}

        {/* <Script
          id="novus-ai-observability"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // ── PASTE YOUR NOVUS.AI SNIPPET BELOW THIS LINE ──────
              //
              // Example (replace with your real API key):
              // (function(n,o,v,u,s,ai){
              //   n[s]=n[s]||function(){(n[s].q=n[s].q||[]).push(arguments)};
              //   var t=document.createElement(o); t.async=1;
              //   t.src='https://cdn.novus.ai/agent.js?apiKey='+ai;
              //   document.head.appendChild(t);
              // })(window,'script',0,0,'novus','YOUR_NOVUS_API_KEY_HERE');
              //
              // ─────────────────────────────────────────────────────
            `,
          }}
        /> */}
      </head>

      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
