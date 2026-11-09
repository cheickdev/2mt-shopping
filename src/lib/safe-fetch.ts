import { lookup } from "node:dns/promises";
import net from "node:net";

// Telechargement d'une page externe en securite : uniquement des sites publics
// (pas le reseau interne du serveur), redirections verifiees, taille et duree
// limitees.

const MAX_REDIRECTS = 5;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Lien invalide.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Seuls les liens http(s) sont acceptés.");
  if (url.username || url.password) throw new Error("Lien invalide.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new Error("Site introuvable.");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Adresse non autorisée.");
  return url;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

export async function safeFetch(
  raw: string,
  { accept = "text/html,application/xhtml+xml,*/*;q=0.8", maxBytes = 4_000_000, timeoutMs = 15000 } = {}
): Promise<{ url: string; contentType: string; body: Buffer }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let current = raw;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const url = await assertPublicUrl(current);
      const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Accept: accept }, redirect: "manual", signal: ctrl.signal });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, url).toString();
        continue;
      }
      if (!res.ok) throw new Error(`Le site a répondu ${res.status}.`);
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > maxBytes) throw new Error("Fichier trop lourd.");
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            ctrl.abort();
            throw new Error("Fichier trop lourd.");
          }
          chunks.push(value);
        }
      }
      return { url: url.toString(), contentType: res.headers.get("content-type") ?? "", body: Buffer.concat(chunks) };
    }
    throw new Error("Trop de redirections.");
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Le site met trop de temps à répondre.");
    if (e instanceof TypeError) throw new Error("Impossible de joindre le site.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
