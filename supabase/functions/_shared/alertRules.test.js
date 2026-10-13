// Run: node --test supabase/functions/_shared/alertRules.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { cairoToEpoch } from "./cairoTime.js";
import { deriveAlerts, planDispatch, buildPayload, escalationText, quietUntil, KINDS } from "./alertRules.js";

const at = (date, hhmm) => { const [h, m] = hhmm.split(":").map(Number); return cairoToEpoch(date, h * 60 + m); };
const NOW = at("2026-10-14", "14:00"); // Wed 14:00 Cairo
const MIN = 60000;
const patients = [{ id: 1, name: "Mirna", zone: "Maadi" }];
const visit = (o) => ({ id: 10, patient_id: 1, doctor_name: "Dr. Mariam", type: "Assessment", date: "2026-10-14", time: "17:00", status: "scheduled", soap_filed: false, ...o });
const derive = (o) => deriveAlerts({ now: NOW, patients, visits: [], bookings: [], openAlerts: [], ...o });

test("booking: alert while the doctor owes an answer; resolves when answered; none once expired", () => {
  const b = { id: 5, status: "pending", doctor_name: "Dr. Mariam", doctor_confirmed: false, requested_date: "2026-10-15", requested_time: "10:00", area: "Maadi", expires_at: new Date(NOW + 30 * MIN).toISOString() };
  const r = derive({ bookings: [b] });
  assert.equal(r.create.length, 1);
  assert.equal(r.create[0].kind, "booking_confirm");
  assert.equal(r.create[0].severity, "critical");
  assert.equal(r.create[0].deadline_at, b.expires_at);

  const open = [{ ...r.create[0], status: "open" }];
  assert.deepEqual(derive({ bookings: [{ ...b, doctor_confirmed: true }], openAlerts: open }).resolve, [{ dedupe_key: open[0].dedupe_key, reason: "answered" }]);
  assert.equal(derive({ bookings: [{ ...b, expires_at: new Date(NOW - MIN).toISOString() }] }).create.length, 0);
  assert.equal(derive({ bookings: [{ ...b, doctor_name: null }] }).create.length, 0); // unassigned: admin's job, not a doctor's
});

test("booking re-assigned to another doctor: old doctor's alert resolves, new doctor's is created", () => {
  const b = { id: 5, status: "pending", doctor_name: "Dr. A", doctor_confirmed: false };
  const open = [{ ...derive({ bookings: [b] }).create[0], status: "open" }];
  const r = derive({ bookings: [{ ...b, doctor_name: "Dr. B" }], openAlerts: open });
  assert.equal(r.create[0].doctor_name, "Dr. B");
  assert.equal(r.resolve.length, 1);
});

test("derive is idempotent: an alert that already exists is not created twice", () => {
  const b = { id: 5, status: "pending", doctor_name: "Dr. A", doctor_confirmed: false };
  const open = [{ ...derive({ bookings: [b] }).create[0], status: "open" }];
  const r = derive({ bookings: [b], openAlerts: open });
  assert.deepEqual([r.create.length, r.resolve.length], [0, 0]);
});

test("session_soon: 60-min heads-up, 15-min urgent, nothing outside the window, resolves at start", () => {
  const kinds = (time) => derive({ visits: [visit({ time })] }).create.map((a) => a.dedupe_key);
  assert.deepEqual(kinds("17:00"), []);            // 3h away
  assert.deepEqual(kinds("14:50"), ["soon60:10"]); // 50 min
  assert.deepEqual(kinds("14:10"), ["soon15:10"]); // 10 min
  assert.deepEqual(kinds("13:59"), []);            // already started (and not over)
  const open = [{ ...derive({ visits: [visit({ time: "14:10" })] }).create[0], status: "open" }];
  assert.equal(derive({ visits: [visit({ time: "13:50" })], openAlerts: open }).resolve[0].reason, "started_or_changed");
});

test("session_log: only after the session ends, within 72h, not when filed/cancelled/unapproved/clockless", () => {
  const keys = (v) => derive({ visits: [v] }).create.map((a) => a.dedupe_key);
  assert.deepEqual(keys(visit({ time: "13:30" })), []);                     // ends 14:15
  assert.deepEqual(keys(visit({ time: "13:00" })), ["log:10"]);             // ended 13:45
  assert.deepEqual(keys(visit({ time: "13:00", duration_min: 90 })), []);   // 90-min session still running
  assert.deepEqual(keys(visit({ time: "13:00", soap_filed: true })), []);
  assert.deepEqual(keys(visit({ time: "13:00", status: "cancelled" })), []);
  assert.deepEqual(keys(visit({ time: "13:00", approved: false })), []);
  assert.deepEqual(keys(visit({ time: "now" })), []);
  assert.deepEqual(keys(visit({ date: "2026-10-09", time: "13:00" })), []); // 5 days ago: stop nagging
  assert.deepEqual(keys(visit({ date: "2026-10-12", time: "13:00" })), ["log:10"]);
  const open = [{ ...derive({ visits: [visit({ time: "13:00" })] }).create[0], status: "open" }];
  assert.equal(derive({ visits: [visit({ time: "13:00", soap_filed: true })], openAlerts: open }).resolve[0].reason, "documented_or_closed");
});

const alert = (o = {}) => ({ id: 1, status: "open", kind: "booking_confirm", attempts: 0, max_attempts: 9, created_at: new Date(NOW).toISOString(), next_attempt_at: new Date(NOW).toISOString(), deadline_at: null, escalated_at: null, acked_at: null, meta: {}, ...o });

test("dispatch ladder: sends now, schedules the next ping from creation time", () => {
  const p = planDispatch(alert(), NOW);
  assert.equal(p.action, "send"); assert.equal(p.attempt, 1);
  assert.equal(p.nextAt, NOW + 2 * MIN);
  assert.equal(p.escalate, false);
});

test("dispatch: not due yet / not open => skip; never schedules in the past after an outage", () => {
  assert.equal(planDispatch(alert({ next_attempt_at: new Date(NOW + 5 * MIN).toISOString() }), NOW).action, "skip");
  assert.equal(planDispatch(alert({ status: "resolved" }), NOW).action, "skip");
  const late = planDispatch(alert({ attempts: 1, created_at: new Date(NOW - 120 * MIN).toISOString() }), NOW);
  assert.equal(late.nextAt, NOW + MIN); // ladder says "2 min after creation" but that is long past
});

test("escalates the admin once after the Nth ping, even if the doctor acked", () => {
  assert.equal(planDispatch(alert({ attempts: 2 }), NOW).escalate, true);
  assert.equal(planDispatch(alert({ attempts: 2, acked_at: new Date(NOW - MIN).toISOString() }), NOW).escalate, true);
  assert.equal(planDispatch(alert({ attempts: 3, escalated_at: new Date(NOW).toISOString() }), NOW).escalate, false);
  assert.match(escalationText(alert({ attempts: 2, doctor_name: "Dr. A", acked_at: "x", meta: { date: "2026-10-15", time: "10:00" } }), NOW), /Dr\. A hasn't dealt with a booking request.*after 3 alerts.*acknowledged/);
});

test("expiry: ladder exhausted or hard deadline passed; the last ping is flagged", () => {
  assert.deepEqual(planDispatch(alert({ attempts: 9 }), NOW), { action: "expire", reason: "exhausted" });
  assert.deepEqual(planDispatch(alert({ deadline_at: new Date(NOW - 1).toISOString() }), NOW), { action: "expire", reason: "deadline" });
  const p = planDispatch(alert({ attempts: 8 }), NOW);
  assert.equal(p.last, true); assert.equal(p.nextAt, null);
  // a heads-up alert (no escalation policy) ending its ladder must NOT page the admin
  assert.equal(planDispatch(alert({ kind: "session_soon", attempts: 1, max_attempts: 2 }), NOW).escalate, false);
});

test("quiet hours 00:30–08:00 defer ordinary alerts but not session_soon or imminent deadlines", () => {
  const night = at("2026-10-14", "03:00");
  assert.equal(quietUntil(night), at("2026-10-14", "08:00"));
  assert.equal(quietUntil(at("2026-10-14", "00:10")), null); // clinic is open until midnight
  assert.equal(quietUntil(at("2026-10-14", "08:00")), null);
  const due = { next_attempt_at: new Date(night - MIN).toISOString(), created_at: new Date(night - 10 * MIN).toISOString() };
  assert.deepEqual(planDispatch(alert({ ...due, kind: "session_log" }), night), { action: "defer", until: at("2026-10-14", "08:00") });
  assert.equal(planDispatch(alert({ ...due, kind: "session_soon" }), night).action, "send");
  assert.equal(planDispatch(alert({ ...due, deadline_at: new Date(night + 60 * MIN).toISOString() }), night).action, "send"); // hold expires in 1h
  assert.equal(planDispatch(alert({ ...due, deadline_at: new Date(night + 6 * 60 * MIN).toISOString() }), night).action, "defer");
});

test("payload gets louder with each unanswered ping and always carries an ack link", () => {
  const a = alert({ id: 7, deadline_at: new Date(NOW + 12 * MIN).toISOString(), severity: "critical", meta: { date: "2026-10-15", time: "10:00:00", area: "Maadi" } });
  const p1 = buildPayload(a, 1, NOW, "https://x/ack?id=7&t=abc"), p5 = buildPayload(a, 5, NOW, "u");
  assert.match(p1.title, /New booking/); assert.match(p5.title, /URGENT/);
  assert.match(p1.body, /2026-10-15 · 10:00 · Maadi.*expires in 12 min/);
  assert.equal(p1.data.ackUrl, "https://x/ack?id=7&t=abc");
  assert.equal(p1.requireInteraction, true); assert.equal(p1.renotify, true); assert.equal(p1.tag, "alert-7"); assert.equal(p1.urgency, "high");
  const log = alert({ kind: "session_log", severity: "high", meta: { patient: "Mirna", endedAt: NOW - 5 * 60 * MIN } });
  assert.match(buildPayload(log, 3, NOW, "u").title, /Mirna's session is 5h overdue/);
  assert.equal(KINDS.session_soon.ackResolves, true);
});
