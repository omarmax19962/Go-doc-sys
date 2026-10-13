/* cairoTime.js — clinic-local time helpers (Africa/Cairo), dependency-free.
 * Shared by the browser (coverage map) and the Supabase edge functions (alert
 * engine) so "09:00 on 2026-10-14" means the same instant everywhere, whatever the
 * device or server timezone. Egypt observes DST, so offsets are resolved with Intl
 * instead of being hard-coded. Visits store date/time as local strings ("YYYY-MM-DD",
 * "HH:MM"); these helpers are the only place that turns them into instants. */

export const CLINIC_TZ = "Africa/Cairo";
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TZ, hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
});

/** Wall-clock parts of instant `ms` in Cairo: { date:"YYYY-MM-DD", hour, minute, dow (0=Sun) }. */
export function cairoParts(ms) {
  const p = {};
  for (const { type, value } of fmt.formatToParts(new Date(ms))) p[type] = value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour), minute: Number(p.minute),
    dow: DAY_NAMES.indexOf(p.weekday),
  };
}

/** Minutes after midnight from "HH:MM" / "H:MM" / "9:30 AM" / "9 PM"; null for "now", "—", junk. */
export function parseTimeOfDay(t) {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)?\s*$/i.exec(String(t ?? ""));
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] || 0);
  if (m[3]) { const pm = m[3].toLowerCase() === "pm"; if (h < 1 || h > 12) return null; h = (h % 12) + (pm ? 12 : 0); }
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Epoch ms of Cairo wall-clock `dateStr` ("YYYY-MM-DD") + `minutes` after midnight; NaN if invalid. */
export function cairoToEpoch(dateStr, minutes) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m || minutes == null || Number.isNaN(minutes)) return NaN;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], 0, minutes);
  // Offset at that wall time: resolve twice so the DST edge lands on the right side.
  let guess = naive;
  for (let i = 0; i < 2; i++) {
    const p = cairoParts(guess);
    const asUtc = Date.UTC(+p.date.slice(0, 4), +p.date.slice(5, 7) - 1, +p.date.slice(8, 10), p.hour, p.minute);
    guess += naive - asUtc;
  }
  return guess;
}

/** "YYYY-MM-DD" + n calendar days (pure date arithmetic, DST-proof). */
export function addDays(dateStr, n) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Day-of-week index (0=Sun) of a "YYYY-MM-DD" calendar date. */
export function dowOf(dateStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}
