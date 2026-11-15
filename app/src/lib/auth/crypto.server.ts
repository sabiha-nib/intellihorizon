// Password hashing and token helpers using Web Crypto (available in Cloudflare Workers).
const ITERATIONS = 100_000; // Workers' PBKDF2 ceiling
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as Uint8Array<ArrayBuffer>, iterations }, key, 256);
  return new Uint8Array(bits);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > ITERATIONS) return false;
  const hash = await derive(password, fromB64url(parts[2]), iterations);
  return timingSafeEqual(hash, fromB64url(parts[3]));
}

/** Spend the same time as a real verification, for unknown accounts. */
export async function dummyVerify(password: string): Promise<void> {
  await derive(password, new Uint8Array(16), ITERATIONS);
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(input: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(input)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** k-anonymity breach check: only the first 5 hex chars of the SHA-1 hash leave the server. Fails open. */
export async function isBreachedPassword(password: string): Promise<boolean> {
  try {
    const d = new Uint8Array(await crypto.subtle.digest("SHA-1", enc.encode(password)));
    const hex = [...d].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = await res.text();
    const suffix = hex.slice(5);
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
