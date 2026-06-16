import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { TopProgressBar } from "@/components/ui/top-progress-bar";
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
        <Script
          id="novus-pendo-install"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track', 'trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
    o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
    y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
    z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('3ee3d22c-3f1c-4709-ac2f-3e8cb4d31b99');
            `,
          }}
        />
        <Script
          id="novus-pendo-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  // Check if the visitor has previously submitted a ticket — we store their
  // real email in localStorage so Pendo can identify them on return visits.
  // This makes the "Dashboard visitors" KPI show real data instead of 0.
  var storedEmail = (typeof localStorage !== 'undefined' && localStorage.getItem('gf_visitor_email')) || null;

  // Fall back to a stable anonymous ID for first-time visitors who haven't
  // yet submitted a ticket. Stored so repeat visits are de-duped.
  var anonId = (typeof localStorage !== 'undefined' && localStorage.getItem('gf_visitor_id'));
  if (!anonId) {
    anonId = 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem('gf_visitor_id', anonId); } catch(e) {}
  }

  // Identified visitor (submitted a ticket before) → use their real email.
  // Anonymous visitor (first visit) → use stable anon ID.
  var visitorId = storedEmail || anonId;

  pendo.initialize({
    visitor: {
      id:    visitorId,
      email: storedEmail || undefined,
      role:  storedEmail ? 'engineer' : 'visitor',
      app:   'ghostfix-dashboard'
    },
    account: { id: 'ghostfix-app', name: 'GhostFix' }
  });
})();
            `,
          }}
        />
      </head>

      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
