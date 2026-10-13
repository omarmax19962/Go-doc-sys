/* alertRules.js — the brain of the doctor alert system. Pure functions only (no
 * Deno, no Supabase, no clock): the alert-dispatch edge function feeds it rows and
 * does the I/O; alertRules.test.js proves the rules. Rows are raw DB rows (snake_case).
 *
 * An ALERT is a thing a doctor must do. It is created when the condition appears,
 * re-pinged on a LADDER (minutes after creation) until the condition clears, and the
 * admin is told when the doctor stays silent. The doctor can ACK ("On it"), which
 * silences pings for a grace period but never resolves the alert — only reality does
 * (booking answered, session logged), so an ack can't be used to make a duty vanish. */
import { cairoParts, cairoToEpoch, parseTimeOfDay } from "./cairoTime.js";

const MIN = 60000;

/* kind → behaviour.
 *  pings:      minutes after creation at which a push is sent (first is 0 = immediately)
 *  graceMin:   how long an ACK silences pings
 *  escalateAt: after this many pings the admin is told (regardless of ack)
 *  ackResolves: ack closes the alert (heads-up alerts that have nothing left to do) */
export const KINDS = {
  booking_confirm: { severity: "critical", pings: [0, 2, 5, 10, 15, 20, 30, 45, 60], graceMin: 5, escalateAt: 3, ackResolves: false },
  session_soon:    { severity: "high",     pings: [0, 5],                            graceMin: 5, escalateAt: null, ackResolves: true },
  session_log:     { severity: "high",     pings: [0, 30, 120, 360, 1440, 2880],     graceMin: 60, escalateAt: 4, ackResolves: false },
};

/* Quiet hours (Cairo): 00:30–08:00. The clinic runs 9am–midnight, so nobody should be
 * woken by a "please log yesterday's session". Time-critical alerts bypass it. */
export const QUIET = { fromMin: 30, toMin: 8 * 60 };
const BYPASS_QUIET_WITHIN_MIN = 120; // …when a hard deadline is this close
const SESSION_SOON_WINDOW_MIN = 65, SESSION_SOON_URGENT_MIN = 15;
const LOG_LOOKBACK_MS = 72 * 60 * MIN;                 // stop chasing sessions older than 3 days
const OPEN_VISIT = new Set(["scheduled", "confirmed", "pending_confirmation", "in_progress"]);

const startOf = (v) => {
  const m = parseTimeOfDay(v.time);
  return m == null ? NaN : cairoToEpoch(v.date, m);
};

/** Instant (ms) quiet hours end, or null if `now` is not in quiet hours. */
export function quietUntil(now) {
  const p = cairoParts(now), m = p.hour * 60 + p.minute;
  return m >= QUIET.fromMin && m < QUIET.toMin ? cairoToEpoch(p.date, QUIET.toMin) : null;
}

/**
 * What alerts should exist right now?
 * @returns {{ create: object[], resolve: {dedupe_key:string, reason:string}[] }}
 */
export function deriveAlerts({ now, visits = [], bookings = [], patients = [], openAlerts = [] }) {
  const pById = new Map(patients.map((p) => [p.id, p]));
  const want = new Map(); // dedupe_key -> alert row
  const add = (kind, key, doctor, meta, deadlineAt = null) => {
    if (!doctor) return;
    const k = KINDS[kind];
    want.set(key, {
      doctor_name: doctor, kind, dedupe_key: key, severity: k.severity, meta,
      max_attempts: k.pings.length, grace_min: k.graceMin, ack_resolves: k.ackResolves,
      deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : null,
      next_attempt_at: new Date(now).toISOString(),
    });
  };

  // 1. a booking request is waiting for this doctor's yes/no
  for (const b of bookings) {
    if (b.status !== "pending" || !b.doctor_name || b.doctor_confirmed) continue;
    const exp = b.expires_at ? Date.parse(b.expires_at) : null;
    if (exp && exp <= now) continue; // hold already expired — nothing left to answer
    add("booking_confirm", `booking:${b.id}:${b.doctor_name}`, b.doctor_name,
      { bookingId: b.id, date: b.requested_date, time: b.requested_time, area: b.area || "", patient: b.name || "" }, exp);
  }

  for (const v of visits) {
    if (!v.doctor_name || !v.date || v.approved === false || !OPEN_VISIT.has(v.status)) continue;
    const start = startOf(v);
    if (Number.isNaN(start)) continue; // "now" / ad-hoc visits have no clock time
    const p = pById.get(v.patient_id) || {};
    const meta = { visitId: v.id, patientId: v.patient_id, patient: p.name || "your patient", zone: p.zone || "", type: v.type || "Session", time: v.time, date: v.date };
    const minsToStart = (start - now) / MIN;

    // 2. a session is about to start (60-min heads-up, then a 15-min "go now")
    if (minsToStart > 0 && minsToStart <= SESSION_SOON_URGENT_MIN) add("session_soon", `soon15:${v.id}`, v.doctor_name, { ...meta, stage: 15 });
    else if (minsToStart > SESSION_SOON_URGENT_MIN && minsToStart <= SESSION_SOON_WINDOW_MIN) add("session_soon", `soon60:${v.id}`, v.doctor_name, { ...meta, stage: 60 });

    // 3. the session is over and not yet documented (logging = the case record + payment)
    const end = start + (Number(v.duration_min) || 45) * MIN;
    if (end <= now && now - end <= LOG_LOOKBACK_MS && !v.soap_filed) add("session_log", `log:${v.id}`, v.doctor_name, { ...meta, endedAt: end });
  }

  const create = [...want.values()].filter((a) => !openAlerts.some((o) => o.dedupe_key === a.dedupe_key));
  const resolve = openAlerts
    .filter((o) => o.status === "open" && !want.has(o.dedupe_key))
    .map((o) => ({ dedupe_key: o.dedupe_key, reason: resolveReason(o, now) }));
  return { create, resolve };
}

function resolveReason(o, now) {
  if (o.kind === "session_soon") return "started_or_changed";
  if (o.kind === "booking_confirm") return o.deadline_at && Date.parse(o.deadline_at) <= now ? "expired" : "answered";
  return "documented_or_closed";
}

/**
 * What should happen to this open alert right now?
 * @returns {{action:'skip'} | {action:'defer',until:number} | {action:'expire',reason:string}
 *          | {action:'send', attempt:number, nextAt:number|null, escalate:boolean, last:boolean}}
 */
export function planDispatch(a, now) {
  if (a.status !== "open") return { action: "skip" };
  if (a.deadline_at && Date.parse(a.deadline_at) <= now) return { action: "expire", reason: "deadline" };
  if (a.attempts >= a.max_attempts) return { action: "expire", reason: "exhausted" };
  if (a.next_attempt_at && Date.parse(a.next_attempt_at) > now) return { action: "skip" };

  const k = KINDS[a.kind];
  const until = quietUntil(now);
  const urgent = a.kind === "session_soon" || (a.deadline_at && Date.parse(a.deadline_at) - now <= BYPASS_QUIET_WITHIN_MIN * MIN);
  if (until && !urgent) return { action: "defer", until };

  const attempt = a.attempts + 1;
  const last = attempt >= a.max_attempts;
  const base = last ? null : Date.parse(a.created_at) + k.pings[attempt] * MIN;
  // never schedule in the past (outage catch-up, quiet-hour deferral): at least 1 min out
  const nextAt = last ? null : Math.max(base, now + MIN);
  return { action: "send", attempt, nextAt, last, escalate: k.escalateAt != null && !a.escalated_at && (attempt >= k.escalateAt || last) };
}

const hhmm = (t) => (t ? String(t).slice(0, 5) : "");
const minsLeft = (a, now) => (a.deadline_at ? Math.max(0, Math.round((Date.parse(a.deadline_at) - now) / MIN)) : null);

/** The push the doctor sees. Gets louder with every unanswered ping. */
export function buildPayload(a, attempt, now, ackUrl) {
  const m = a.meta || {};
  let title, body;
  if (a.kind === "booking_confirm") {
    const left = minsLeft(a, now);
    title = attempt >= 4 ? "🚨 URGENT — a patient is waiting on your answer" : attempt >= 2 ? "🔴 Booking still waiting for you" : "🔴 New booking — answer now";
    body = `${[m.date, hhmm(m.time)].filter(Boolean).join(" · ")}${m.area ? ` · ${m.area}` : ""}. Are you available?${left != null ? ` ⏳ Hold expires in ${left} min.` : ""}`;
  } else if (a.kind === "session_soon") {
    title = a.meta.stage === 15 ? `⏰ Session in 15 min — ${m.patient}` : `Session in about an hour — ${m.patient}`;
    body = `${m.type} at ${hhmm(m.time)}${m.zone ? ` · ${m.zone}` : ""}. Tap to open the patient file.`;
  } else {
    const overdueH = Math.max(0, Math.round((now - (m.endedAt || now)) / (60 * MIN)));
    title = attempt >= 3 ? `🚨 ${m.patient}'s session is ${overdueH}h overdue` : attempt === 2 ? `📝 Still not logged — ${m.patient}` : `📝 Log ${m.patient}'s session`;
    body = "Logging records the case and releases your payment. It takes a minute.";
  }
  const critical = a.severity === "critical";
  return {
    title, body, tag: `alert-${a.id}`, renotify: true, requireInteraction: true, silent: false,
    vibrate: critical ? [300, 100, 300, 100, 600] : [200, 100, 200],
    actions: [{ action: "open", title: "Open" }, { action: "ack", title: a.ack_resolves ? "Got it" : "On it" }],
    data: { url: "/", alertId: a.id, ackUrl, link: a.link || null }, urgency: critical ? "high" : "normal",
  };
}

/** Text for the admin when a doctor stays silent. */
export function escalationText(a) {
  const m = a.meta || {};
  const what = a.kind === "booking_confirm" ? `a booking request (${[m.date, hhmm(m.time)].filter(Boolean).join(" ")}${m.area ? `, ${m.area}` : ""})`
    : a.kind === "session_log" ? `logging ${m.patient}'s session` : `the session with ${m.patient}`;
  const acked = a.acked_at ? " They acknowledged it but it's still open." : "";
  return `⚠ ${a.doctor_name} hasn't dealt with ${what} after ${a.attempts + 1} alerts.${acked}`;
}
