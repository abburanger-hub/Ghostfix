import type { NextConfig } from "next";
import path from "path";

// Pin the node binary so Turbopack worker processes use v20, not the system
// Node v5 that lives in /home/abrar-22512/nodejs/.
if (!process.env.NODE) {
  process.env.NODE = process.execPath;
}

const nextConfig: NextConfig = {
  // Allow the local network IP to access dev HMR resources
  allowedDevOrigins: ["172.20.10.4", "172.28.0.1"],
  // Tell Turbopack the actual project root so it doesn't pick up the
  // stray package-lock.json in $HOME and try to use the wrong node.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
