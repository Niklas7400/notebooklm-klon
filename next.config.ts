import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eigenstaendiges Server-Bundle (nur die tatsaechlich benoetigten
  // node_modules) statt des vollen node_modules-Baums -- Grundlage fuer ein
  // schlankes Docker-Image, siehe Dockerfile.
  output: "standalone",
};

export default nextConfig;
