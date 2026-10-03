import { execSync, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const VIRTUAL_IFACE =
  /virtual|vmware|vbox|virtualbox|hyper-?v|docker|wsl|loopback|vethernet|bluetooth|pseudo|tap|tun|vpn|zerotier|hamachi|radmin|npcap/i;

function isIPv4(addr) {
  return addr.family === "IPv4" || addr.family === 4;
}

function scoreAddress(name, address) {
  let score = 0;
  if (/wi-?fi|wlan|wireless|ethernet|lan|local area/i.test(name)) score += 30;
  if (address.startsWith("192.168.")) score += 20;
  else if (address.startsWith("10.")) score += 10;
  else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) score += 5;
  if (address.startsWith("192.168.56.")) score -= 100;
  if (address.startsWith("172.27.") || address.startsWith("172.28.") || address.startsWith("172.29."))
    score -= 80;
  if (VIRTUAL_IFACE.test(name)) score -= 100;
  return score;
}

function getLanCandidates() {
  const ifaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (!isIPv4(addr) || addr.internal) continue;
      if (addr.address.startsWith("169.254.")) continue;
      const score = scoreAddress(name, addr.address);
      if (score <= -50) continue;
      candidates.push({ name, address: addr.address, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address));
  return candidates;
}

function printLanUrls(candidates) {
  if (candidates.length === 0) {
    console.log(`LAN  —`);
    return;
  }
  for (const [i, c] of candidates.entries()) {
    const label = i === 0 ? "LAN" : "   ";
    console.log(`${label}  http://${c.address}:${PORT}`);
  }
}

function isNextUrlLine(line) {
  return /^\s*-?\s*(Local|Network):\s/i.test(line);
}

/** Kill whatever is listening on PORT so `npm run dev` always starts. */
function freePort(port) {
  if (process.platform === "win32") {
    let out = "";
    try {
      out = execSync(`netstat -ano`, { encoding: "utf8" });
    } catch {
      return;
    }
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== "0" && pid !== String(process.pid)) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
        console.log(`freed :${port} (pid ${pid})`);
      } catch {
        /* already gone */
      }
    }
    return;
  }

  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
    }).trim();
    for (const pid of out.split(/\n/).filter(Boolean)) {
      if (pid === String(process.pid)) continue;
      try {
        process.kill(Number(pid), "SIGKILL");
        console.log(`freed :${port} (pid ${pid})`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* nothing listening */
  }
}

freePort(PORT);

const nextBin = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--hostname", HOST, "--port", String(PORT)],
  {
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
    windowsHide: true,
  },
);

let readyAnnounced = false;
let carry = { out: "", err: "" };

function onData(chunk, stream, key) {
  carry[key] += chunk.toString();
  const parts = carry[key].split(/\r?\n/);
  carry[key] = parts.pop() ?? "";

  for (const line of parts) {
    if (isNextUrlLine(line)) continue;
    stream.write(line + "\n");

    if (!readyAnnounced && /✓\s*Ready in/i.test(line)) {
      readyAnnounced = true;
      console.log("");
      printLanUrls(getLanCandidates());
      console.log("");
    }
  }
}

child.stdout?.on("data", (c) => onData(c, process.stdout, "out"));
child.stderr?.on("data", (c) => onData(c, process.stderr, "err"));

child.on("exit", (code, signal) => {
  for (const [key, stream] of [
    ["out", process.stdout],
    ["err", process.stderr],
  ]) {
    const rest = carry[key];
    if (rest && !isNextUrlLine(rest)) stream.write(rest);
  }
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
