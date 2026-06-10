import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the local network IP to access dev HMR resources
  allowedDevOrigins: ["172.28.0.1"],
};

export default nextConfig;
