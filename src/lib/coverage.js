/* coverage.js — turns doctors + visits + patients + booking requests into the
 * numbers the coverage map shows. Pure functions (no React, no I/O) so the rules are
 * unit-tested in coverage.test.js.
 *
 * Model: a doctor has a weekly template of hourly slots ("Sun-09:00") and a set of
 * zones they cover. The template is NOT per-zone — a doctor can only be in one place
 * per slot — so per-zone numbers overlap for multi-zone doctors, while `totals`
 * counts every doctor-slot exactly once. */
import { ZONES, ZONE_GEO, GOVERNORATES, zoneFromText } from "./zones.js";
import { DAY_NAMES, cairoParts, cairoToEpoch, addDays, dowOf, parseTimeOfDay } from "../../supabase/functions/_shared/cairoTime.js";

export const HORIZON_DAYS = 7;
// Visit statuses that free the slot again. Everything else holds it.
const SLOT_FREEING = new Set(["cancelled", "rescheduled", "postponed", "no_show", "missed"]);
// Patient statuses that no longer generate demand.
const DEAD_PATIENT = new Set(["discharged", "lost"]);
const LEAD_STATUS = new Set(["lead", "follow_up", "didnt_reply"]);
const OPEN_REQUEST = new Set(["pending", "doctor_confirmed"]);

/** Hour bands the filter offers. [from, to) in 24h clinic time. */
export const BANDS = {
  all: { label: "All day", from: 0, to: 24 },
  morning: { label: "Morning · 9–12", from: 9, to: 12 },
  afternoon: { label: "Afternoon · 12–5", from: 12, to: 17 },
  evening: { label: "Evening · 5–12", from: 17, to: 24 },
  night: { label: "Late night · 12–9", from: 0, to: 9 },
};

/** "Sun-09:00" → { day:"Sun", hour:9 } (null if malformed). */
export function parseSlot(key) {
  const m = /^([A-Za-z]{3})-(\d{1,2}):(\d{2})$/.exec(key || "");
  return m && DAY_NAMES.includes(m[1]) ? { day: m[1], hour: Number(m[2]) } : null;
}

const emptyByDay = () => Object.fromEntries(DAY_NAMES.map((d) => [d, 0]));

/** Supply of one doctor: weekly template size, and open/booked slots over the horizon. */
function doctorSupply(doctor, visits, now, filter, horizonDays) {
  const band = BANDS[filter.band] || BANDS.all;
  const slots = (doctor.slots || []).map(parseSlot).filter(Boolean)
    .filter((s) => (!filter.day || s.day === filter.day) && s.hour >= band.from && s.hour < band.to);
  const out = { weekly: slots.length, open: 0, booked: 0, byDay: emptyByDay(), openByDay: emptyByDay() };
  for (const s of slots) out.byDay[s.day]++;

  // Hours already held by this doctor's live visits: "YYYY-MM-DD|hour"
  const held = new Set();
  for (const v of visits) {
    if (v.doctorName !== doctor.name || SLOT_FREEING.has(v.status) || !v.date) continue;
    const mins = parseTimeOfDay(v.time);
    if (mins != null) held.add(`${v.date}|${Math.floor(mins / 60)}`);
  }
  const today = cairoParts(now).date;
  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(today, i);
    const dayName = DAY_NAMES[dowOf(date)];
    for (const s of slots) {
      if (s.day !== dayName) continue;
      if (cairoToEpoch(date, s.hour * 60 + 59) <= now) continue; // hour already over
      if (held.has(`${date}|${s.hour}`)) { out.booked++; continue; }
      out.open++; out.openByDay[s.day]++;
    }
  }
  return out;
}

/** Status of a zone given supply and demand. `reason` is the one-line explanation shown in the UI. */
export function zoneStatus({ doctors, weekly, open, demand }) {
  if (doctors === 0) return demand > 0
    ? { status: "gap", reason: `${demand} waiting, no doctor covers this zone` }
    : { status: "idle", reason: "No doctor and no demand" };
  if (weekly === 0) return { status: "gap", reason: "Doctors cover it but have set no availability" };
  if (open === 0) return { status: "full", reason: `All ${weekly} weekly slots are booked for the next ${HORIZON_DAYS} days` };
  if (demand > 0 && open < demand) return { status: "thin", reason: `${open} open slot${open === 1 ? "" : "s"} for ${demand} waiting` };
  return { status: "ok", reason: demand > 0 ? `${open} open slots for ${demand} waiting` : `${open} open slots, no queue` };
}

/**
 * @param {object} i
 * @param {Array}  i.doctors          [{name, zones[], slots[]}]
 * @param {Array}  i.visits           [{doctorName, date, time, status}]
 * @param {Array}  i.patients         [{zone, status, doctor}]
 * @param {Array}  i.bookingRequests  [{area, status}]
 * @param {number} [i.now]            epoch ms
 * @param {object} [i.filter]         {day:"Sun"|null, band:"all"|…, doctor:name|null}
 */
export function computeCoverage({ doctors = [], visits = [], patients = [], bookingRequests = [], now = Date.now(), filter = {} }) {
  const f = { day: filter.day || null, band: filter.band || "all", doctor: filter.doctor || null };
  const pool = f.doctor ? doctors.filter((d) => d.name === f.doctor) : doctors;
  const supply = new Map(pool.map((d) => [d.name, doctorSupply(d, visits, now, f, HORIZON_DAYS)]));

  const zones = {};
  for (const z of ZONES) {
    const geo = ZONE_GEO[z];
    zones[z] = {
      zone: z, gov: geo ? geo.gov : null, mappable: !!geo,
      doctors: [], weekly: 0, open: 0, booked: 0, byDay: emptyByDay(), openByDay: emptyByDay(),
      demand: { patients: 0, leads: 0, requests: 0, unassigned: 0, total: 0 },
    };
  }

  for (const d of pool) {
    const s = supply.get(d.name);
    for (const zn of d.zones || []) {
      const row = zones[zn];
      if (!row) continue; // zone removed from the registry — ignore stale reference
      row.doctors.push(d.name);
      row.weekly += s.weekly; row.open += s.open; row.booked += s.booked;
      for (const k of DAY_NAMES) { row.byDay[k] += s.byDay[k]; row.openByDay[k] += s.openByDay[k]; }
    }
  }

  let unmappedDemand = 0, demandAll = 0;
  const addDemand = (zn, kind, unassigned) => {
    demandAll++;
    const row = zones[zn];
    if (!row || !row.mappable) { unmappedDemand++; if (!row) return; } // no/unknown zone: counted, can't be pinned
    row.demand[kind]++; row.demand.total++;
    if (unassigned) row.demand.unassigned++;
  };
  for (const p of patients) {
    if (DEAD_PATIENT.has(p.status)) continue;
    const unassigned = !p.doctor || p.doctor === "—";
    addDemand(p.zone, LEAD_STATUS.has(p.status) ? "leads" : "patients", unassigned);
  }
  for (const b of bookingRequests) {
    if (!OPEN_REQUEST.has(b.status)) continue;
    addDemand(zoneFromText(b.area), "requests", !b.doctorName);
  }

  for (const row of Object.values(zones)) {
    Object.assign(row, zoneStatus({ doctors: row.doctors.length, weekly: row.weekly, open: row.open, demand: row.demand.total }));
    row.dim = !!f.doctor && row.doctors.length === 0;
  }

  // Egypt-wide totals: every doctor-slot once, regardless of how many zones it spans.
  const placed = pool.filter((d) => (d.zones || []).some((zn) => zones[zn]));
  const totals = { doctors: placed.length, weekly: 0, open: 0, booked: 0, demand: demandAll, zonesCovered: 0, zonesTotal: Object.keys(ZONE_GEO).length, unmappedDemand };
  for (const d of placed) { const s = supply.get(d.name); totals.weekly += s.weekly; totals.open += s.open; totals.booked += s.booked; }
  for (const row of Object.values(zones)) if (row.mappable && row.doctors.length) totals.zonesCovered++;
  const noZoneDoctors = pool.filter((d) => !(d.zones || []).some((zn) => zones[zn])).map((d) => d.name);

  // Governorate roll-up for the Egypt view (doctors/slots de-duplicated within a governorate).
  const governorates = {};
  for (const g of GOVERNORATES) governorates[g.id] = { id: g.id, zones: 0, covered: 0, doctors: new Set(), demand: 0, weekly: 0, open: 0 };
  for (const row of Object.values(zones)) {
    const g = governorates[row.gov]; if (!g) continue;
    g.zones++; g.demand += row.demand.total; if (row.doctors.length) g.covered++;
    row.doctors.forEach((n) => g.doctors.add(n));
  }
  for (const g of Object.values(governorates)) {
    for (const n of g.doctors) { const s = supply.get(n); g.weekly += s.weekly; g.open += s.open; }
    g.doctors = g.doctors.size;
  }

  return { zones, totals, governorates, noZoneDoctors, filter: f, generatedAt: now };
}
