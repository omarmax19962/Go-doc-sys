# Coverage map & doctor alerts

## 1. Coverage map (admin → **Map** tab)

**Reading it.** Bubble size = open slots in the next 7 days. Colour = health:

| Status | Meaning |
|---|---|
| Uncovered (red, dashed, pulsing) | People are waiting and no doctor covers the zone — or doctors cover it but set no availability |
| Fully booked | A doctor covers it; every slot in the next 7 days is taken |
| Running thin | Fewer open slots than people waiting |
| Healthy | Open slots ≥ people waiting |
| No activity (grey dot) | No doctor and no demand |

"Waiting" = active patients + leads + open booking requests in that zone. Booking requests carry free text, so they are matched to a zone by name (English or Arabic, longest match wins).

**Egypt vs zones.** Zoomed out, governorates are shown (Greater Cairo as one bubble; grey dots = governorates with no zones yet). Zoomed in, each zone is a bubble. Today only Greater Cairo has zones.
**Adding an area:** add it to `ZONES`, `ZONE_AR` and `ZONE_GEO` in `src/lib/zones.js` — pickers and map update together.

**Numbers you should know about**
- A doctor's weekly slots are **not per zone**; a doctor covering 3 zones can only be in one place per slot. Per-zone figures therefore overlap; the KPI totals count every doctor-slot once. The zone panel says when slots are shared.
- A slot is *booked* if the doctor has a live visit (any status except cancelled / rescheduled / postponed / no-show / missed) in that hour. Hours already past today are not counted as open.
- Doctors with no zone are not on the map; the first KPI flags them.
- Patients/leads with zone "Other / outside Greater Cairo" or blank are counted as "not pinnable".
- Times use Africa/Cairo (DST-aware), not the device's timezone.

Logic: `src/lib/coverage.js` (tests: `node --test src/lib/coverage.test.js`). Tiles: CARTO/OpenStreetMap (attribution shown; fine at this volume — switch `TILE` in `CoverageMap.jsx` if usage grows).

## 2. Aggressive doctor alerts

**Principle.** Aggressive = *persistent, escalating, impossible to miss, accountable* — not noisy. Doctors who get buzzed at 3 AM turn notifications off, and that kills the channel for good. So: loud when it matters, silent when it doesn't, and the admin hears when a doctor goes quiet.

### What triggers an alert
| Kind | Created when | Pings (min after creation) | Admin told | Ends when |
|---|---|---|---|---|
| `booking_confirm` (critical) | A booking request is assigned to the doctor and they haven't answered | 0, 2, 5, 10, 15, 20, 30, 45, 60 | after 3rd ping | Doctor answers, request reassigned/expires |
| `session_soon` | Visit starts in ≤ 65 min (15-min "go now" stage after) | 0, 5 | never | Visit starts/changes; **ack closes it** |
| `session_log` | Visit has ended and no note filed (up to 3 days back) | 0, 30m, 2h, 6h, 1d, 2d | after 4th ping | Note filed / visit closed |

Each ping is louder: title and tone escalate ("New booking" → "Still waiting" → "URGENT"). Same notification tag + `renotify`, so every ping buzzes again instead of silently replacing the last.

### What the doctor sees
- **App closed:** Web Push that stays on screen (`requireInteraction`), vibrates, with **Open** and **On it** buttons. *On it* works from the lock screen (Android/desktop) without opening the app.
- **App open:** a full-screen takeover that can't be swiped away — only acknowledged — plus flashing tab title, app-icon badge, vibration and a beep every 25 s (mute toggle). If the doctor is **mid-note**, it becomes a slim top banner so their text is never lost.
- **Permission off:** a red banner in the Visits screen explains what they're missing (and the iPhone "Add to Home Screen" prerequisite).

### Rules that keep it fair
- **Ack ≠ done.** "On it" pauses pings (5 min for bookings, 60 for logging). Only reality ends a duty (booking answered, note filed), so ack can't hide work. Admin escalation happens regardless of ack.
- **Quiet hours 00:30–08:00 Cairo.** Pings are held until 08:00, except `session_soon` and bookings whose hold expires within 2 h.
- **No spam loops.** One alert per duty, ever (`dedupe_key`); a ladder has a hard end (then the admin is told once).
- **Outage-safe.** After downtime the ladder resumes from "now", never fires a burst.
- **No reachable device.** If a *critical* alert has no working push subscription, the admin is told immediately. Dead subscriptions are removed automatically.
- Overlapping runs can't double-ping (each ping is claimed atomically).
- The existing one-shot "time to document" reminder and normal notifications are unchanged.

### Deploy (one time)
1. SQL editor → run `supabase/migrations/20261013_doctor_alerts.sql`.
2. Secrets (Supabase → Edge Functions → Secrets, or `supabase secrets set`):
   `VAPID_PRIVATE_KEY` (private half of the key whose public half is in `src/lib/push.js`; ⚠ if you no longer have it, generate a new pair, replace `VAPID_PUBLIC_KEY` in `push.js`, and have doctors reopen the app once to re-subscribe), `VAPID_SUBJECT` (`mailto:…`), `ALERT_ACK_SECRET` and `CRON_SECRET` (long random strings).
3. `supabase functions deploy alert-dispatch alert-ack --no-verify-jwt`
4. Run the `cron.schedule(...)` snippet at the bottom of the migration (fill in project ref + `CRON_SECRET`).
5. Check: `select * from doctor_alerts order by id desc;` and call the function once manually.

**Kill switch:** `select cron.unschedule('doctor-alerts-every-minute');` — everything else keeps working; the app tolerates the table being empty or missing.

### Tests
`node --test supabase/functions/_shared/alertRules.test.js supabase/functions/_shared/dispatch.test.js` — includes a minute-by-minute simulation of a silent doctor, ack, quiet hours, dead subscriptions and overlapping runs.

### Not built yet (deliberately)
Admin-side alert log screen; per-doctor quiet-hour preferences; a doctor-facing "claim this lead" flow (leads are admin-assigned today, so there's nothing actionable to alert on); WhatsApp fallback for doctors without push.
