/* AlertTakeover — what a doctor sees while the app is open and something urgent is
 * unacknowledged. A full-screen takeover (can't be tapped away — only acknowledged),
 * or a slim banner when the doctor is mid-note so we never destroy their work. */
import { useEffect, useRef, useState } from "react";
import { BellRing, BellOff, Siren, Volume2, VolumeX } from "lucide-react";
import { buildPayload } from "../../supabase/functions/_shared/alertRules.js";
import { useAttention } from "../lib/alerts";
import { ensureNotifyPermission, notifPermission, pushSupported, subscribeToPush } from "../lib/push";

const C = { ink: "#1E2A3A", teal: "#7DD8DF", line: "#E6EBEE", grey: "#8794A1", red: "#C0392B", amber: "#E0A458", green: "#3FA796" };
const HEAD = "'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif";

const view = (a) => { const p = buildPayload(a, Math.max(1, a.attempts || 1), Date.now(), ""); return { title: p.title, body: p.body }; };
const graceLabel = (m) => (m >= 60 ? `${Math.round(m / 60)} h` : `${m} min`);
const actionFor = (a) => a.kind === "booking_confirm"
  ? { label: "Answer now", link: { view: "visits" } }
  : a.kind === "session_log" ? { label: "Log session now", link: a.meta?.patientId ? { patientId: a.meta.patientId } : { view: "visits" } }
  : { label: "Open patient file", link: a.meta?.patientId ? { patientId: a.meta.patientId } : { view: "visits" } };

function useCountdown(deadline) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return undefined;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [deadline]);
  return deadline ? Math.max(0, Math.round((Date.parse(deadline) - now) / 1000)) : null;
}

export default function AlertTakeover({ alerts, onAck, onOpen, banner = false }) {
  const [sound, setSound] = useState(() => { try { return localStorage.getItem("godoc-alert-sound") !== "off"; } catch { return true; } });
  useAttention(alerts.length, { sound });
  const top = alerts[0];
  const left = useCountdown(top?.deadline_at);
  const primary = useRef(null);
  useEffect(() => { if (top && !banner) primary.current?.focus(); }, [top?.id, banner]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!top) return null;

  const v = view(top), act = actionFor(top), critical = top.severity === "critical";
  const more = alerts.length - 1;
  const ackLabel = top.ack_resolves ? "Got it" : `On it — remind me in ${graceLabel(top.grace_min)}`;
  const go = () => { onAck(top.id); onOpen && onOpen(act.link); };
  const mm = left != null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : null;
  const toggleSound = () => setSound((s) => { const n = !s; try { localStorage.setItem("godoc-alert-sound", n ? "on" : "off"); } catch { /* private mode */ } return n; });

  if (banner) {
    return (
      <div role="alert" aria-live="assertive" className="fixed top-0 inset-x-0 z-[900] flex items-center gap-2 px-3 py-2 text-white text-[12px]" style={{ background: critical ? C.red : C.ink, paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <Siren size={16} className="shrink-0" />
        <span className="flex-1 min-w-0 truncate font-bold">{v.title}{more > 0 ? ` (+${more})` : ""}</span>
        <button onClick={() => onAck(top.id)} className="px-2.5 py-1 rounded-lg font-bold shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>{top.ack_resolves ? "Got it" : "On it"}</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-3" style={{ background: "rgba(20,28,40,0.72)", backdropFilter: "blur(2px)" }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="gd-alert-title" aria-describedby="gd-alert-body" className="w-full max-w-[420px] rounded-3xl overflow-hidden bg-white" style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}>
        <div className="flex items-center gap-2 px-5 py-2.5 text-white text-[11px] font-extrabold uppercase tracking-wider" style={{ background: critical ? C.red : C.ink, animation: critical ? "gd-alert-pulse 1.4s ease-in-out infinite" : "none" }}>
          <BellRing size={14} />{critical ? "Needs your answer now" : "Action needed"}
          {more > 0 && <span className="ml-auto px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.22)" }}>+{more} more</span>}
        </div>
        <div className="px-5 pt-4 pb-5">
          <h2 id="gd-alert-title" className="text-[19px] font-extrabold leading-snug" style={{ fontFamily: HEAD, color: C.ink }}>{v.title}</h2>
          <p id="gd-alert-body" className="text-[14px] mt-1.5" style={{ color: "#2E3440" }}>{v.body}</p>
          {mm != null && <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-bold" style={{ background: left < 600 ? "#FDF3F1" : "#FBF4E6", color: left < 600 ? C.red : "#9A6B25" }}>⏳ Hold expires in <span style={{ fontVariantNumeric: "tabular-nums" }}>{mm}</span></div>}
          <button ref={primary} onClick={go} className="w-full mt-4 py-3.5 rounded-2xl text-[15px] font-extrabold text-white" style={{ background: critical ? C.red : C.ink }}>{act.label}</button>
          <button onClick={() => onAck(top.id)} className="w-full mt-2 py-3 rounded-2xl text-[13px] font-bold" style={{ background: "#fff", color: C.ink, border: `1px solid ${C.line}` }}>{ackLabel}</button>
          <div className="flex items-center justify-between mt-3 text-[11px]" style={{ color: C.grey }}>
            <span>{top.ack_resolves ? "" : "“On it” pauses alerts — it doesn’t close the task."}</span>
            <button onClick={toggleSound} className="flex items-center gap-1 font-semibold" aria-label={sound ? "Mute alert sound" : "Unmute alert sound"}>{sound ? <Volume2 size={13} /> : <VolumeX size={13} />}{sound ? "Sound on" : "Muted"}</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes gd-alert-pulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25)}}`}</style>
    </div>
  );
}

/* Without notification permission the whole system silently degrades to in-app only, so
 * tell the doctor loudly — and explain the iOS "Add to Home Screen" prerequisite. */
export function AlertsOffBanner({ me }) {
  const [perm, setPerm] = useState(notifPermission());
  const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && (window.navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches);
  if (perm === "granted") return null;
  const needsInstall = ios && !standalone && !pushSupported();
  const enable = async () => { const r = await ensureNotifyPermission(); setPerm(r); if (r === "granted") { try { await subscribeToPush({ role: "doctor", identity: me }); } catch { /* retried on next load */ } } };
  return (
    <div role="status" className="mx-4 mt-3 rounded-2xl px-3.5 py-3 flex items-start gap-2.5" style={{ background: "#FDF3F1", border: `1px solid ${C.red}44` }}>
      <BellOff size={18} color={C.red} className="shrink-0 mt-0.5" />
      <div className="flex-1 text-[12px]" style={{ color: C.ink }}>
        <b>You won’t get urgent alerts.</b>{" "}
        {needsInstall ? "On iPhone, tap Share → “Add to Home Screen”, open Go Doc from there, then turn alerts on."
          : perm === "denied" ? "Notifications are blocked — allow them for this site in your browser or phone settings."
          : "New booking requests and overdue sessions are sent as push alerts, even when the app is closed."}
        {perm === "default" && !needsInstall && <button onClick={enable} className="block mt-2 px-3.5 py-2 rounded-xl text-[12px] font-extrabold text-white" style={{ background: C.red }}>Turn on alerts</button>}
      </div>
    </div>
  );
}
