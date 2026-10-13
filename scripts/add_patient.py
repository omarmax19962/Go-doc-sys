#!/usr/bin/env python3
"""Add a patient (and optionally their first booked session) to Go Doc.

Mirrors what the app's addPatient() does so nothing is left half-done:
patient row -> visit row -> billing row (config default fee/pct) -> admin + doctor
notifications (+ best-effort device push via the send-push edge function).

Runs as a real admin through the normal API, so Row Level Security applies; no
service-role key is needed. Dry-run is the default; nothing is written without --apply.

  export SUPABASE_URL=https://xxxx.supabase.co
  export SUPABASE_ANON_KEY=...            # same public key as .env.local
  export GODOC_ADMIN_EMAIL=...  GODOC_ADMIN_PASSWORD=...
  python3 scripts/add_patient.py scripts/patients/mirna-hossam-tawfik.json            # check only
  python3 scripts/add_patient.py scripts/patients/mirna-hossam-tawfik.json --apply    # write

Input JSON: {"patient": {...app patient fields...}, "booking": {doctor,date,time,type}|null}
"""
import argparse, json, os, re, sys, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timezone

def die(msg):
    print(f"✗ {msg}", file=sys.stderr); sys.exit(1)

def http(method, url, key, token=None, body=None, prefer=None):
    h = {"apikey": key, "Content-Type": "application/json", "Authorization": f"Bearer {token or key}"}
    if prefer: h["Prefer"] = prefer
    req = urllib.request.Request(url, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read(); return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url.split('?')[0]} -> {e.code}: {e.read().decode()[:300]}")

def validate(p, b):
    errs = []
    for f in ("name", "phone", "complaint"):          # same required set as the intake form
        if not str(p.get(f, "")).strip(): errs.append(f"patient.{f} is required (intake form requires it)")
    if b:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", b.get("date", "")): errs.append("booking.date must be YYYY-MM-DD")
        if not re.fullmatch(r"\d{2}:\d{2}", b.get("time", "")): errs.append("booking.time must be HH:MM (24h)")
        if not b.get("doctor"): errs.append("booking.doctor is required")
        elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", b.get("date", "")):
            if datetime.strptime(b["date"], "%Y-%m-%d").date() < datetime.now().date(): errs.append("booking.date is in the past")
    return errs

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file"); ap.add_argument("--apply", action="store_true", help="actually write (default: check only)")
    a = ap.parse_args()
    data = json.load(open(a.file, encoding="utf-8")); p, b = data["patient"], data.get("booking")

    errs = validate(p, b)
    if errs: die("fix the input first:\n  - " + "\n  - ".join(errs))

    url, key = os.environ.get("SUPABASE_URL", "").rstrip("/"), os.environ.get("SUPABASE_ANON_KEY", "")
    email, pw = os.environ.get("GODOC_ADMIN_EMAIL"), os.environ.get("GODOC_ADMIN_PASSWORD")
    if not (url and key and email and pw):
        print("✓ input is valid. Set SUPABASE_URL / SUPABASE_ANON_KEY / GODOC_ADMIN_EMAIL / GODOC_ADMIN_PASSWORD to check against the live data.")
        return

    tok = http("POST", f"{url}/auth/v1/token?grant_type=password", key, body={"email": email, "password": pw})["access_token"]
    rest = lambda t, q="": f"{url}/rest/v1/{t}{q}"
    doctor = None
    if b:
        docs = http("GET", rest("doctors", "?select=name,slots"), key, tok)
        hits = [d for d in docs if b["doctor"].lower() in d["name"].lower()]
        if len(hits) != 1: die(f"doctor '{b['doctor']}' matched {len(hits)} of: {[d['name'] for d in docs]}")
        doctor = hits[0]["name"]
        hour = int(b["time"][:2])
        taken = http("GET", rest("visits", f"?select=id,time,status&doctor_name=eq.{urllib.parse.quote(doctor)}&date=eq.{b['date']}"), key, tok)
        clash = [v for v in taken if v["status"] not in ("cancelled", "rescheduled", "postponed", "no_show", "missed") and str(v.get("time", ""))[:2] == b["time"][:2]]
        if clash: die(f"{doctor} already has a session at {hour:02d}:00 on {b['date']} (visit {clash[0]['id']})")
        dow = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][datetime.strptime(b["date"], "%Y-%m-%d").weekday()]
        if f"{dow}-{b['time'][:2]}:00" not in hits[0].get("slots", []): print(f"! note: {doctor} has no availability slot {dow}-{b['time'][:2]}:00 (booking is still allowed)")
    dup = http("GET", rest("patients", f"?select=id,name&phone=eq.{urllib.parse.quote(p['phone'].strip())}"), key, tok)
    if dup: die(f"phone already belongs to patient #{dup[0]['id']} ({dup[0]['name']}) — open that file instead")

    print(f"✓ checks passed: {p['name']}" + (f" -> {doctor} on {b['date']} {b['time']}" if b else " (lead, no booking)"))
    if not a.apply: print("  dry run — re-run with --apply to write."); return

    now = datetime.now(timezone.utc).isoformat()
    status = "booked" if b else "lead"
    row = {"name": p["name"].strip(), "age": p.get("age"), "gender": p.get("gender"), "phone": p["phone"].strip(), "complaint": p["complaint"].strip(),
           "history": p.get("history", ""), "files": [], "tags": p.get("tags", []), "zone": p.get("zone", ""), "loc_text": p.get("locText", ""),
           "loc_url": p.get("locUrl", ""), "dx": None, "status": status, "doctor": doctor or "—", "payment": "Pending",
           "status_history": [{"from": None, "to": status, "by": "Admin", "note": f"Booked with {doctor}" if b else "Intake — lead", "at": now}],
           "source": (p.get("source") or None), "referrer_consent": False}
    pt = http("POST", rest("patients"), key, tok, row, "return=representation")[0]
    print(f"✓ patient #{pt['id']} created")
    link = {"patientId": pt["id"]}
    if b:
        v = http("POST", rest("visits"), key, tok, {"patient_id": pt["id"], "doctor_name": doctor, "type": b.get("type", "Assessment"), "time": b["time"], "date": b["date"], "status": "scheduled"}, "return=representation")[0]
        cfg = (http("GET", rest("config", "?select=default_fee,default_pct&id=eq.1"), key, tok) or [{}])[0]
        http("POST", rest("finances"), key, tok, {"date": b["date"], "doctor": doctor, "patient": pt["name"], "type": v["type"], "fee": cfg.get("default_fee", 500), "pct": cfg.get("default_pct", 0.6), "status": "Pending", "method": "Cash", "visit_id": v["id"]})
        print(f"✓ visit #{v['id']} booked + billing row created")
    when = f"{b['date']} {b['time']}" if b else ""
    msgs = [("admin", None, f"New booking: {pt['name']} → {doctor} ({when})" if b else f"New lead added: {pt['name']}")]
    if b: msgs.append(("doctor", doctor, f"New patient booked with you: {pt['name']} ({when})"))
    for target, to, text in msgs:
        http("POST", rest("notifications"), key, tok, {"target": target, "to": to, "text": text, "link": link})
        try: http("POST", f"{url}/functions/v1/send-push", key, tok, {"target": target, "to": to, "text": text, "link": link})
        except Exception as e: print(f"! device push for {target} not sent ({str(e)[:80]})")
    print("✓ notifications sent. Done.")

if __name__ == "__main__":
    main()
