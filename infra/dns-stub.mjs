// Tiny DNS server for the hub, for machines without dnsmasq (Windows).
// Answers an A record for HUB_DOMAIN with HUB_IP and nothing else. No upstream DNS.
// Usage: HUB_DOMAIN=hub.example.dev HUB_IP=192.168.8.10 node infra/dns-stub.mjs
import dgram from "node:dgram";

const domain = (process.env.HUB_DOMAIN ?? "").toLowerCase();
const ip = process.env.HUB_IP ?? "";
const port = Number(process.env.DNS_PORT ?? 53);
const octets = ip.split(".").map(Number);

if (!domain || octets.length !== 4 || octets.some((n) => !(n >= 0 && n <= 255))) {
  console.error("Set HUB_DOMAIN (hub.example.dev) and HUB_IP (192.168.8.10).");
  process.exit(1);
}

function readName(msg, start) {
  const labels = [];
  let i = start;
  while (i < msg.length && msg[i] !== 0) {
    labels.push(msg.toString("ascii", i + 1, i + 1 + msg[i]));
    i += msg[i] + 1;
  }
  return { name: labels.join(".").toLowerCase(), end: i + 1 };
}

function reply(msg) {
  if (msg.length < 17) return null;
  const { name, end } = readName(msg, 12);
  // Drop a truncated question instead of reading past the end of the packet.
  if (end + 4 > msg.length) return null;
  const type = msg.readUInt16BE(end);
  const question = msg.subarray(12, end + 4);
  const match = name === domain;
  const answers = match && type === 1 ? 1 : 0;
  // Flags: response, recursion available. NXDOMAIN for other names, empty answer for other types.
  const rcode = match ? 0 : 3;
  const head = Buffer.alloc(12);
  head.writeUInt16BE(msg.readUInt16BE(0), 0);
  head.writeUInt16BE(0x8180 | rcode, 2);
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(answers, 6);
  const parts = [head, question];
  if (answers) {
    const rr = Buffer.alloc(16);
    rr.writeUInt16BE(0xc00c, 0);
    rr.writeUInt16BE(1, 2);
    rr.writeUInt16BE(1, 4);
    rr.writeUInt32BE(60, 6);
    rr.writeUInt16BE(4, 10);
    octets.forEach((n, k) => rr.writeUInt8(n, 12 + k));
    parts.push(rr);
  }
  return Buffer.concat(parts);
}

const server = dgram.createSocket("udp4");
server.on("message", (msg, rinfo) => {
  // One bad packet from a phone must never stop the hub.
  try {
    const out = reply(msg);
    if (out) server.send(out, rinfo.port, rinfo.address, () => {});
  } catch {
    // Ignore malformed packets.
  }
});
server.on("error", (err) => {
  console.error(`DNS stub failed: ${err.message}`);
  process.exit(1);
});
// Same as listen-address in dnsmasq.conf: answer on the hub IP only, not every interface.
server.bind({ port, address: ip }, () => console.log(`DNS stub: ${domain} -> ${ip} on udp ${port}`));
