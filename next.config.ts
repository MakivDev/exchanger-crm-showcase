import type { NextConfig } from "next";
import os from "node:os";

/** Hosts that may load /_next/* in `next dev` (LAN phone, 127.0.0.1, etc.). */
function allowedDevHosts(): string[] {
  const hosts = new Set<string>(["127.0.0.1", "localhost"]);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      const v4 = addr.family === "IPv4" || addr.family === 4;
      if (!v4 || addr.internal) continue;
      if (addr.address.startsWith("169.254.")) continue;
      hosts.add(addr.address);
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: allowedDevHosts(),
};

export default nextConfig;
