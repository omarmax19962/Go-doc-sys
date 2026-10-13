/* ackToken.js — HMAC token that lets a notification button acknowledge one alert
 * without a login. The token is embedded in the (end-to-end encrypted) push payload,
 * so only the doctor's own device ever sees it, and it only works for that alert id. */
const enc = new TextEncoder();

export async function ackToken(secret, id) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`ack:${id}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyAckToken(secret, id, token) {
  const good = await ackToken(secret, id);
  if (typeof token !== "string" || token.length !== good.length) return false;
  let diff = 0; // constant-time compare
  for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
