// Run: node --test supabase/functions/_shared/dispatch.test.js
// Time-travel simulation of the engine against an in-memory store.
import test from "node:test";
import assert from "node:assert/strict";
import { cairoToEpoch } from "./cairoTime.js";
import { runDispatch } from "./dispatch.js";
import { ackToken, verifyAckToken } from "./ackToken.js";

const MIN = 60000;
const at = (d, hhmm) => { const [h, m] = hhmm.split(":").map(Number); return cairoToEpoch(d, h * 60 + m); };

function world({ bookings = [], visits = [], patients = [], subs = { "Dr. A": [{ id: 1, endpoint: "e1" }] } } = {}) {
  const w = { alerts: [], sent: [], admin: [], bookings, visits, patients, subs, nextId: 1, removed: [] };
  w.store = {
    loadContext: async () => ({ visits: w.visits, patients: w.patients, bookings: w.bookings, openAlerts: w.alerts.filter((a) => a.status === "open") }),
    createAlerts: async (rows) => rows.forEach((r) => { if (!w.alerts.some((a) => a.dedupe_key === r.dedupe_key)) w.alerts.push({ id: w.nextId++, status: "open", attempts: 0, escalated_at: null, acked_at: null, created_at: r.next_attempt_at, ...r }); }),
    resolveAlerts: async (list) => list.forEach(({ dedupe_key, reason }) => { const a = w.alerts.find((x) => x.dedupe_key === dedupe_key && x.status === "open"); if (a) Object.assign(a, { status: "resolved", resolved_reason: reason }); }),
    dueAlerts: async (now) => w.alerts.filter((a) => a.status === "open" && Date.parse(a.next_attempt_at) <= now).map((a) => ({ ...a })),
    claim: async (a, patch) => { const cur = w.alerts.find((x) => x.id === a.id); if (cur.status !== "open" || cur.attempts !== a.attempts) return false; Object.assign(cur, patch); return true; },
    update: async (id, patch) => Object.assign(w.alerts.find((x) => x.id === id), patch),
    subscriptions: async (role, identity) => (role === "doctor" ? w.subs[identity] || [] : []),
    removeSubscription: async (id) => { w.removed.push(id); },
    notifyAdmin: async (t) => { w.admin.push(t); },
  };
  w.push = { send: async (sub, payload) => { w.sent.push({ sub: sub.endpoint, title: payload.title }); return w.gone?.has(sub.endpoint) ? { ok: false, gone: true } : { ok: true, gone: false }; } };
  w.tick = (now) => runDispatch({ now, store: w.store, push: w.push, ackUrlFor: async (id) => `ack/${id}` });
  return w;
}
const booking = (o = {}) => ({ id: 5, status: "pending", doctor_name: "Dr. A", doctor_confirmed: false, requested_date: "2026-10-15", requested_time: "10:00", area: "Maadi", expires_at: null, ...o });

test("silent doctor: pings follow the ladder, admin is told once at ping 3, ladder ends in expiry", async () => {
  const T0 = at("2026-10-14", "14:00"), w = world({ bookings: [booking()] });
  const pingMinutes = [];
  for (let m = 0; m <= 75; m++) { const before = w.sent.length; await w.tick(T0 + m * MIN); if (w.sent.length > before) pingMinutes.push(m); }
  assert.deepEqual(pingMinutes, [0, 2, 5, 10, 15, 20, 30, 45, 60]);
  assert.equal(w.admin.length, 1);                                  // escalated exactly once…
  assert.match(w.admin[0], /Dr\. A hasn't dealt with a booking request.*after 3 alerts/);
  assert.equal(w.alerts[0].status, "expired");                      // …and the ladder ended
  assert.equal(w.alerts[0].resolved_reason, "exhausted");
  const titles = w.sent.map((s) => s.title);
  assert.match(titles[0], /New booking/); assert.match(titles[8], /URGENT/);
});

test("doctor answers: alert resolves on the next tick and pinging stops", async () => {
  const T0 = at("2026-10-14", "14:00"), w = world({ bookings: [booking()] });
  await w.tick(T0); await w.tick(T0 + 2 * MIN);
  assert.equal(w.sent.length, 2);
  w.bookings = [booking({ doctor_confirmed: true, status: "doctor_confirmed" })];
  await w.tick(T0 + 5 * MIN); await w.tick(T0 + 10 * MIN);
  assert.equal(w.sent.length, 2);
  assert.equal(w.alerts[0].status, "resolved"); assert.equal(w.alerts[0].resolved_reason, "answered");
  assert.equal(w.admin.length, 0);
});

test("ack silences pings for the grace period, then the ladder resumes", async () => {
  const T0 = at("2026-10-14", "14:00"), w = world({ bookings: [booking()] });
  await w.tick(T0);
  // what _ack_alert does in SQL
  Object.assign(w.alerts[0], { acked_at: iso(T0 + MIN), next_attempt_at: iso(Math.max(Date.parse(w.alerts[0].next_attempt_at), T0 + MIN + 5 * MIN)) });
  for (let m = 1; m <= 5; m++) await w.tick(T0 + m * MIN);
  assert.equal(w.sent.length, 1);                                   // ladder said +2, ack held it to +6
  await w.tick(T0 + 6 * MIN);
  assert.equal(w.sent.length, 2);
  assert.equal(w.alerts[0].status, "open");                         // ack never resolves a duty
});
const iso = (ms) => new Date(ms).toISOString();

test("dead push subscription is removed; a critical alert with no reachable device alerts the admin immediately", async () => {
  const T0 = at("2026-10-14", "14:00"), w = world({ bookings: [booking()] });
  w.gone = new Set(["e1"]);
  await w.tick(T0);
  assert.deepEqual(w.removed, [1]);
  assert.equal(w.admin.length, 1); assert.match(w.admin[0], /no working device alerts/);
  await w.tick(T0 + 2 * MIN);                                       // no subs left; still no duplicate admin ping
  assert.equal(w.admin.length, 1);
});

test("overlapping runs can't double-ping the same attempt", async () => {
  const T0 = at("2026-10-14", "14:00"), w = world({ bookings: [booking()] });
  await Promise.all([w.tick(T0), w.tick(T0)]);
  assert.equal(w.sent.length, 1);
});

test("session day: heads-up at 60, urgent at 15, resolves at start, then log chase after it ends", async () => {
  const w = world({ patients: [{ id: 1, name: "Mirna", zone: "Maadi" }], visits: [{ id: 9, patient_id: 1, doctor_name: "Dr. A", date: "2026-10-14", time: "17:00", status: "scheduled", soap_filed: false }] });
  const seen = [];
  for (let m = -70; m <= 120; m++) { const before = w.sent.length; await w.tick(at("2026-10-14", "17:00") + m * MIN); for (const s of w.sent.slice(before)) seen.push([m, s.title]); }
  assert.match(seen[0][1], /about an hour/);                         // first ping inside the 65-min window
  assert.ok(seen.some(([m, t]) => m >= -15 && m < 0 && /in 15 min/.test(t)));
  const logPings = seen.filter(([, t]) => /session/i.test(t) && /Log|logged|overdue/.test(t));
  assert.equal(logPings[0][0], 45);                                  // 45-min session ends 17:45 -> first chase
  assert.equal(w.alerts.filter((a) => a.kind === "session_soon" && a.status === "open").length, 0);
  assert.equal(w.admin.length, 0);                                   // not yet 4 pings
});

test("session logged => chase stops; quiet hours hold pings until 08:00", async () => {
  const w = world({ patients: [{ id: 1, name: "Mirna", zone: "" }], visits: [{ id: 9, patient_id: 1, doctor_name: "Dr. A", date: "2026-10-13", time: "23:00", status: "scheduled", soap_filed: false }] });
  await w.tick(at("2026-10-14", "00:10"));                           // 23:45 end -> 00:10 is NOT quiet: pings
  assert.equal(w.sent.length, 1);
  await w.tick(at("2026-10-14", "01:00"));                           // +50 min: ladder says +30 -> due, but quiet
  assert.equal(w.sent.length, 1);
  await w.tick(at("2026-10-14", "07:59")); assert.equal(w.sent.length, 1);
  await w.tick(at("2026-10-14", "08:00")); assert.equal(w.sent.length, 2); // released at 08:00
  w.visits[0].soap_filed = true;
  await w.tick(at("2026-10-14", "12:00"));
  assert.equal(w.sent.length, 2);
  assert.equal(w.alerts[0].status, "resolved");
});

test("ack token: verifies for its own alert only", async () => {
  const t = await ackToken("s3cret", 42);
  assert.equal(await verifyAckToken("s3cret", 42, t), true);
  assert.equal(await verifyAckToken("s3cret", 43, t), false);
  assert.equal(await verifyAckToken("other", 42, t), false);
  assert.equal(await verifyAckToken("s3cret", 42, "abc"), false);
  assert.equal(await verifyAckToken("s3cret", 42, undefined), false);
});
