// alert-ack — the "On it" button inside a push notification. No login: the signed token
// in the link proves the caller received the push for this exact alert. POST (from the
// service worker) or GET (fallback link). Secrets: ALERT_ACK_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyAckToken } from "../_shared/ackToken.js";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const u = new URL(req.url);
  const id = Number(u.searchParams.get("id")), token = u.searchParams.get("t") ?? "";
  const secret = Deno.env.get("ALERT_ACK_SECRET");
  if (!secret || !Number.isInteger(id) || id <= 0 || !(await verifyAckToken(secret, id, token))) {
    return new Response("invalid link", { status: 403, headers: cors });
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { error } = await db.rpc("_ack_alert", { p_id: id });
  if (error) { console.error("ack failed", error); return new Response("error", { status: 500, headers: cors }); }
  if (req.method === "GET") return new Response("<meta charset=utf-8><meta name=viewport content='width=device-width'><body style='font:600 18px system-ui;padding:3rem;text-align:center'>✓ Got it — we'll stop for now.", { headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } });
  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
});
