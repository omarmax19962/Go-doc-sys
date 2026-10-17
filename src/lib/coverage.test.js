// Run: node --test src/lib/coverage.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { cairoParts, cairoToEpoch, parseTimeOfDay, addDays, dowOf } from "../../supabase/functions/_shared/cairoTime.js";
import { computeCoverage, zoneStatus, parseSlot } from "./coverage.js";

test("cairo time resolves DST correctly (UTC+2 winter, UTC+3 summer)", () => {
  assert.equal(new Date(cairoToEpoch("2026-01-15", 9 * 60)).toISOString(), "2026-01-15T07:00:00.000Z");
  assert.equal(new Date(cairoToEpoch("2026-07-15", 9 * 60)).toISOString(), "2026-07-15T06:00:00.000Z");
  const p = cairoParts(Date.UTC(2026, 6, 15, 21, 30)); // 21:30Z = 00:30 next day in Cairo (UTC+3)
  assert.deepEqual([p.date, p.hour, p.minute], ["2026-07-16", 0, 30]);
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(dowOf("2026-10-14"), 3); // Wednesday
});

test("time-of-day parsing", () => {
  assert.equal(parseTimeOfDay("09:00"), 540);
  assert.equal(parseTimeOfDay("9:30 PM"), 21 * 60 + 30);
  assert.equal(parseTimeOfDay("12:00 AM"), 0);
  assert.equal(parseTimeOfDay("now"), null);
  assert.equal(parseTimeOfDay("—"), null);
  assert.equal(parseTimeOfDay("25:00"), null);
});

test("slot keys", () => {
  assert.deepEqual(parseSlot("Tue-13:00"), { day: "Tue", hour: 13 });
  assert.equal(parseSlot("Funday-13:00"), null);
});

// Wed 2026-10-14 08:00 Cairo (UTC+3 until Oct 29)
const NOW = cairoToEpoch("2026-10-14", 8 * 60);
const docs = [
  { name: "Dr. A", zones: ["Maadi", "Dokki"], slots: ["Wed-09:00", "Wed-11:00", "Fri-09:00"] },
  { name: "Dr. B", zones: ["Maadi"], slots: ["Wed-09:00"] },
  { name: "Dr. C", zones: [], slots: ["Wed-10:00"] },
];

test("open slots exclude booked hours and de-duplicate across zones in totals", () => {
  const visits = [{ doctorName: "Dr. A", date: "2026-10-14", time: "09:30", status: "scheduled" }];
  const c = computeCoverage({ doctors: docs, visits, patients: [], bookingRequests: [], now: NOW });
  // Dr. A over 7 days from Wed: Wed 09,11 + Fri 09 = 3; Wed 09 booked -> 2 open, 1 booked. (next Wed is day 7 => outside)
  assert.equal(c.zones["Dokki"].open, 2);
  assert.equal(c.zones["Dokki"].booked, 1);
  // Maadi = Dr. A (2 open) + Dr. B (Wed 09 open = 1)
  assert.equal(c.zones["Maadi"].open, 3);
  assert.deepEqual(c.zones["Maadi"].doctors, ["Dr. A", "Dr. B"]);
  // Totals count Dr. A once even though A covers two zones; Dr. C has no zone so is unplaced.
  assert.equal(c.totals.open, 3);
  assert.equal(c.totals.weekly, 4);
  assert.deepEqual(c.noZoneDoctors, ["Dr. C"]);
});

test("cancelled visits free the slot; past hours today are not open", () => {
  const visits = [{ doctorName: "Dr. B", date: "2026-10-14", time: "09:00", status: "cancelled" }];
  let c = computeCoverage({ doctors: docs, visits, patients: [], bookingRequests: [], now: NOW });
  assert.equal(c.zones["Maadi"].open, 4); // A: 3 open + B: 1 (B's cancelled visit doesn't hold its slot)
  const lateNow = cairoToEpoch("2026-10-14", 10 * 60 + 30); // 09:00 slot is over, 11:00 is not
  c = computeCoverage({ doctors: docs, visits, patients: [], bookingRequests: [], now: lateNow });
  assert.equal(c.zones["Dokki"].open, 2); // Wed 11:00 + Fri 09:00
  assert.equal(c.zones["Maadi"].open, 2);
});

test("day / band / doctor filters", () => {
  const base = { doctors: docs, visits: [], patients: [], bookingRequests: [], now: NOW };
  assert.equal(computeCoverage({ ...base, filter: { day: "Fri" } }).zones["Dokki"].weekly, 1);
  assert.equal(computeCoverage({ ...base, filter: { band: "afternoon" } }).zones["Dokki"].weekly, 0);
  const c = computeCoverage({ ...base, filter: { doctor: "Dr. B" } });
  assert.equal(c.zones["Maadi"].weekly, 1);
  assert.equal(c.zones["Dokki"].dim, true);
});

test("demand: leads/patients/requests, dead patients ignored, free-text area mapped", () => {
  const patients = [
    { zone: "Nasr City", status: "lead", doctor: "—" },
    { zone: "Nasr City", status: "active", doctor: "Dr. A" },
    { zone: "Nasr City", status: "discharged", doctor: "Dr. A" },
    { zone: "Other / outside Greater Cairo", status: "lead", doctor: "—" },
    { zone: "", status: "lead", doctor: "—" },
  ];
  const bookingRequests = [
    { area: "شارع 9 المعادي", status: "pending", doctorName: "" },
    { area: "Nasr City", status: "confirmed", doctorName: "Dr. A" }, // already handled -> no demand
  ];
  const c = computeCoverage({ doctors: docs, visits: [], patients, bookingRequests, now: NOW });
  const nc = c.zones["Nasr City"];
  assert.deepEqual([nc.demand.leads, nc.demand.patients, nc.demand.unassigned, nc.demand.total], [1, 1, 1, 2]);
  assert.equal(nc.status, "gap"); // demand but no doctor
  assert.equal(c.zones["Maadi"].demand.requests, 1);
  assert.equal(c.totals.demand, 5);
  assert.equal(c.totals.unmappedDemand, 2); // "Other" + blank zone
});

test("per-zone availability splits hours by zone; totals stay deduped; missing zone falls back", () => {
  const split = [{
    name: "Dr. Z", zones: ["Maadi", "Dokki"],
    slots: ["Wed-09:00", "Wed-11:00", "Fri-09:00"],
    zoneSlots: { Maadi: ["Wed-09:00"], Dokki: ["Wed-11:00", "Fri-09:00"] },
  }];
  const c = computeCoverage({ doctors: split, visits: [], patients: [], bookingRequests: [], now: NOW });
  assert.equal(c.zones["Maadi"].weekly, 1); // only Wed-09:00 is worked in Maadi
  assert.equal(c.zones["Dokki"].weekly, 2); // Wed-11:00 + Fri-09:00 in Dokki
  assert.equal(c.totals.weekly, 3);         // 3 distinct hours, counted once (no overlap)

  // A covered zone with no per-zone entry falls back to the general template.
  const mixed = [{ name: "Dr. Y", zones: ["Maadi", "Dokki"], slots: ["Wed-09:00", "Wed-11:00"], zoneSlots: { Maadi: ["Wed-09:00"] } }];
  const c2 = computeCoverage({ doctors: mixed, visits: [], patients: [], bookingRequests: [], now: NOW });
  assert.equal(c2.zones["Maadi"].weekly, 1); // per-zone override
  assert.equal(c2.zones["Dokki"].weekly, 2); // general template (both hours)
  assert.equal(c2.totals.weekly, 2);         // Wed-09:00 + Wed-11:00
});

test("zone status ladder", () => {
  assert.equal(zoneStatus({ doctors: 0, weekly: 0, open: 0, demand: 0 }).status, "idle");
  assert.equal(zoneStatus({ doctors: 0, weekly: 0, open: 0, demand: 2 }).status, "gap");
  assert.equal(zoneStatus({ doctors: 1, weekly: 0, open: 0, demand: 0 }).status, "gap");
  assert.equal(zoneStatus({ doctors: 1, weekly: 5, open: 0, demand: 0 }).status, "full");
  assert.equal(zoneStatus({ doctors: 1, weekly: 5, open: 2, demand: 4 }).status, "thin");
  assert.equal(zoneStatus({ doctors: 1, weekly: 5, open: 4, demand: 4 }).status, "ok");
});
