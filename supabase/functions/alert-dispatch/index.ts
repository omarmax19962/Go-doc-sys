// alert-dispatch — one tick of the doctor alert engine. Called every minute by pg_cron.
// All decisions live in ../_shared (pure + unit-tested); this file only wires in the
// real database and Web Push. Secrets (supabase secrets set …):
//   VAPID_PRIVATE_KEY   private half of the key whose public half is in src/lib/push.js
//   VAPID_SUBJECT       e.g. mailto:ops@godoc.example
//   ALERT_ACK_SECRET    random string; signs the one-tap "On it" links
//   CRON_SECRET         random string; the scheduler sends it as x-cron-secret
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { runDispatch } from "../_shared/dispatch.js";
import { ackToken } from "../_shared/ackToken.js";
import { cairoParts, addDays } from "../_shared/cairoTime.js";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ??
  "BIslGbOLTSG_67icgRHrxPXyCDn6OtCgh1jOIxrPZw7xqUxn7mvh35npccOJzsCB3j5fXjubx3_6yuvQY3g7xf0";
const need = (k: string) => Deno.env.get(k) ?? (() => { throw new Error(`missing secret ${k}`); })();

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-cron-secret") !== need("CRON_SECRET")) return new Response("forbidden", { status: 403 });
    const url = need("SUPABASE_URL"), ackSecret = need("ALERT_ACK_SECRET");
    const db = createClient(url, need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    webpush.setVapidDetails(need("VAPID_SUBJECT"), VAPID_PUBLIC_KEY, need("VAPID_PRIVATE_KEY"));
    const iso = (ms: number) => new Date(ms).toISOString();
    const ok = <T>(r: { data: T | null; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data as T; };

    const store = {
      async loadContext(now: number) {
        const today = cairoParts(now).date;
        const visits = ok(await db.from("visits").select("*").gte("date", addDays(today, -4)).lte("date", addDays(today, 1))
          .in("status", ["scheduled", "confirmed", "pending_confirmation", "in_progress"])) ?? [];
        const ids = [...new Set(visits.map((v: { patient_id: number }) => v.patient_id))];
        const patients = ids.length ? ok(await db.from("patients").select("id,name,zone").in("id", ids)) ?? [] : [];
        const bookings = ok(await db.from("booking_requests").select("*").eq("status", "pending")) ?? [];
        const openAlerts = ok(await db.from("doctor_alerts").select("*").eq("status", "open")) ?? [];
        return { visits, patients, bookings, openAlerts };
      },
      async createAlerts(rows: unknown[]) { ok(await db.from("doctor_alerts").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })); },
      async resolveAlerts(list: { dedupe_key: string; reason: string }[]) {
        for (const r of list) ok(await db.from("doctor_alerts").update({ status: "resolved", resolved_at: iso(Date.now()), resolved_reason: r.reason }).eq("dedupe_key", r.dedupe_key).eq("status", "open"));
      },
      async dueAlerts(now: number) { return ok(await db.from("doctor_alerts").select("*").eq("status", "open").lte("next_attempt_at", iso(now)).order("id").limit(200)) ?? []; },
      // optimistic claim: only succeeds if nobody else advanced this alert since we read it
      async claim(a: { id: number; attempts: number }, patch: Record<string, unknown>) {
        const rows = ok(await db.from("doctor_alerts").update(patch).eq("id", a.id).eq("attempts", a.attempts).eq("status", "open").select("id"));
        return !!rows && rows.length > 0;
      },
      async update(id: number, patch: Record<string, unknown>) { ok(await db.from("doctor_alerts").update(patch).eq("id", id)); },
      async subscriptions(role: string, identity: string | null) {
        let q = db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("role", role);
        if (identity) q = q.eq("identity", identity);
        return ok(await q) ?? [];
      },
      async removeSubscription(id: number) { ok(await db.from("push_subscriptions").delete().eq("id", id)); },
      async notifyAdmin(text: string) {
        ok(await db.from("notifications").insert({ target: "admin", to: null, text, link: { view: "doctors" } }));
        for (const s of await store.subscriptions("admin", null)) {
          await push.send(s, { title: "Doctor not responding", body: text, tag: `esc-${Date.now()}`, requireInteraction: true, renotify: true, vibrate: [200, 100, 200], data: { url: "/" } }, { urgency: "high", ttl: 3600 });
        }
      },
    };

    const push = {
      async send(s: { endpoint: string; p256dh: string; auth: string }, payload: unknown, opts: { urgency?: string; ttl?: number }) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: opts.ttl ?? 3600, urgency: (opts.urgency as "high" | "normal") ?? "normal" });
          return { ok: true, gone: false };
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          return { ok: false, gone: code === 404 || code === 410 };
        }
      },
    };

    const result = await runDispatch({ now: Date.now(), store, push, ackUrlFor: async (id: number) => `${url}/functions/v1/alert-ack?id=${id}&t=${await ackToken(ackSecret, id)}` });
    // housekeeping: closed alerts older than 30 days
    await db.from("doctor_alerts").delete().neq("status", "open").lt("created_at", iso(Date.now() - 30 * 86400000));
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("alert-dispatch failed", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
