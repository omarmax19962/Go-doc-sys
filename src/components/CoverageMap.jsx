/* CoverageMap — where Go Doc doctors work, and how many slots are left there.
 * Map (Leaflet) + zone list + zone detail. All numbers come from lib/coverage.js
 * (pure + unit-tested); this file only draws them.
 *
 * Reading the map: bubble SIZE = open slots in the next 7 days, bubble COLOUR =
 * health (see STATUS). Zoomed out to Egypt you see governorates; zoom in (or press
 * "Greater Cairo") for zones. */
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, Stethoscope, Users, Clock, TriangleAlert, Layers } from "lucide-react";
import { ZONES, ZONE_AR, ZONE_GEO, GOVERNORATES, zoneMatch } from "../lib/zones";
import { computeCoverage, BANDS, HORIZON_DAYS } from "../lib/coverage";
import { DAY_NAMES } from "../../supabase/functions/_shared/cairoTime.js";

// Same palette as App.jsx (kept local so this component stays self-contained).
const C = { bg: "#F3F6F7", ink: "#1E2A3A", ink2: "#2E3440", teal: "#7DD8DF", line: "#E6EBEE", grey: "#8794A1", amber: "#E0A458", green: "#3FA796", red: "#C0392B" };
const HEAD = "'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif";

// status → colour, label, and sort rank (lower = needs attention sooner)
const STATUS = {
  gap:  { color: C.red,     label: "Uncovered",    rank: 0, hint: "People are waiting and nobody can take them" },
  full: { color: "#D9714E", label: "Fully booked", rank: 1, hint: "A doctor covers it but every slot is taken" },
  thin: { color: C.amber,   label: "Running thin", rank: 2, hint: "Fewer open slots than people waiting" },
  ok:   { color: C.green,   label: "Healthy",      rank: 3, hint: "Open slots cover the queue" },
  idle: { color: "#B8C2CB", label: "No activity",  rank: 4, hint: "No doctor and no demand" },
};
const TILE = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const EGYPT_BOUNDS = [[21.8, 24.6], [32.0, 37.0]];
const ZOOM_ZONES = 9; // at or above this zoom we draw zones, below it governorates
// Governorates that render as one bubble at country scale (their centroids overlap there).
const METRO = { name: "Greater Cairo", members: ["Cairo", "Giza", "Qalyubia"] };

const bubble = ({ size, color, text, hollow, selected, dim, pulse, dot }) =>
  dot // tiny quiet marker for zones/governorates with nothing going on
    ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;opacity:${dim ? 0.2 : 0.75};box-shadow:${selected ? `0 0 0 4px ${C.teal}88,` : ""}0 1px 2px rgba(30,42,58,.3)"></div>`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:${hollow ? "rgba(255,255,255,0.9)" : color};border:${selected ? 3 : 2}px ${hollow ? "dashed" : "solid"} ${selected ? C.ink : hollow ? color : "#fff"};
    color:${hollow ? color : "#fff"};font:800 ${size > 34 ? 14 : 11}px ${HEAD};opacity:${dim ? 0.3 : 0.94};
    box-shadow:${selected ? `0 0 0 4px ${C.teal}88,` : ""}0 1px 4px rgba(30,42,58,.35);${pulse ? "animation:gd-pulse 1.8s ease-out infinite;" : ""}">${text ?? ""}</div>`;

const sizeFor = (n, min = 22, max = 46) => Math.round(Math.min(max, min + 4.5 * Math.sqrt(Math.max(0, n))));

export default function CoverageMap({ doctors = [], visits = [], patients = [], bookingRequests = [], onGoTab }) {
  const [filter, setFilter] = useState({ day: "", band: "all", doctor: "" });
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState(10);
  const [now, setNow] = useState(() => Date.now());
  const [onlyAttention, setOnlyAttention] = useState(false);
  const mapEl = useRef(null), mapRef = useRef(null), layerRef = useRef(null), fittedRef = useRef(false);

  // Open-slot counts shrink as the day goes on — refresh once a minute.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  const cov = useMemo(
    () => computeCoverage({ doctors, visits, patients, bookingRequests, now, filter }),
    [doctors, visits, patients, bookingRequests, filter, now],
  );

  /* ---- map lifecycle ---- */
  useEffect(() => {
    const map = L.map(mapEl.current, {
      zoomControl: true, minZoom: 5, maxZoom: 15, attributionControl: true,
      maxBounds: [[19.5, 22], [34.5, 39]], maxBoundsViscosity: 0.6, worldCopyJump: false,
    });
    L.tileLayer(TILE, { attribution: ATTR, subdomains: "abcd", maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on("zoomend", () => setZoom(map.getZoom()));
    mapRef.current = map;
    map.fitBounds(zoneBounds(), { padding: [24, 24] });
    setZoom(map.getZoom());
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  /* ---- draw bubbles whenever data / zoom / selection changes ---- */
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const add = (lat, lng, html, size, tip, onClick, z = 0) => {
      const m = L.marker([lat, lng], { icon: L.divIcon({ html, className: "gd-bubble", iconSize: [size, size], iconAnchor: [size / 2, size / 2] }), zIndexOffset: z, keyboard: true });
      m.bindTooltip(tip, { direction: "top", offset: [0, -size / 2], className: "gd-tip" });
      if (onClick) m.on("click", onClick);
      m.addTo(layer);
    };
    if (zoom >= ZOOM_ZONES) {
      for (const z of ZONES) {
        const geo = ZONE_GEO[z]; if (!geo) continue;
        const r = cov.zones[z], st = STATUS[r.status], sel = selected === z;
        const idle = r.status === "idle";
        const size = idle ? 12 : sizeFor(r.open);
        add(geo.lat, geo.lng,
          bubble({ size, color: st.color, text: r.open, dot: idle, hollow: r.status === "gap", selected: sel, dim: r.dim, pulse: r.status === "gap" && !r.dim }),
          size, `<b>${z}</b>${ZONE_AR[z] ? ` · ${ZONE_AR[z]}` : ""}<br>${st.label} — ${r.open} open / ${r.weekly} weekly · ${r.doctors.length} doctor${r.doctors.length === 1 ? "" : "s"} · ${r.demand.total} waiting`,
          () => select(z), sel ? 1000 : r.status === "gap" ? 500 : Math.round(r.open));
      }
    } else {
      const grouped = new Set(METRO.members);
      const drawGov = (name, members, lat, lng) => {
        const rows = members.map((id) => cov.governorates[id]);
        const zones = rows.reduce((a, g) => a + g.zones, 0);
        if (!zones) { // nothing configured here yet
          add(lat, lng, bubble({ size: 10, color: "#B8C2CB", dot: true }), 10, `<b>${name}</b><br>No zones configured yet`, null);
          return;
        }
        const open = rows.reduce((a, g) => a + g.open, 0), demand = rows.reduce((a, g) => a + g.demand, 0);
        const covered = rows.reduce((a, g) => a + g.covered, 0);
        const docs = new Set(); members.forEach((id) => Object.values(cov.zones).filter((zr) => zr.gov === id).forEach((zr) => zr.doctors.forEach((d) => docs.add(d))));
        const color = covered === 0 ? C.red : open < demand ? C.amber : C.green;
        const size = sizeFor(open, 30, 64);
        add(lat, lng, bubble({ size, color, text: open }), size,
          `<b>${name}</b><br>${open} open slots (next ${HORIZON_DAYS}d) · ${docs.size} doctors<br>${covered}/${zones} zones covered · ${demand} waiting<br><i>Click to zoom in</i>`,
          () => map.fitBounds(zoneBounds(members), { padding: [40, 40], maxZoom: 11 }), 800);
      };
      const mem = METRO.members.map((id) => GOVERNORATES.find((g) => g.id === id));
      drawGov(METRO.name, METRO.members, mem[0].lat, mem[0].lng);
      for (const g of GOVERNORATES) if (!grouped.has(g.id)) drawGov(g.id, [g.id], g.lat, g.lng);
    }
  }, [cov, zoom, selected]);

  function zoneBounds(govs) {
    const pts = Object.entries(ZONE_GEO).filter(([, g]) => !govs || govs.includes(g.gov)).map(([, g]) => [g.lat, g.lng]);
    return L.latLngBounds(pts);
  }
  function select(z) {
    setSelected(z);
    const geo = ZONE_GEO[z], map = mapRef.current;
    if (geo && map) map.flyTo([geo.lat, geo.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
  }
  const showEgypt = () => { fittedRef.current = true; mapRef.current?.fitBounds(EGYPT_BOUNDS, { padding: [10, 10] }); };
  const showCairo = () => mapRef.current?.fitBounds(zoneBounds(), { padding: [24, 24] });

  /* ---- list data ---- */
  const rows = useMemo(() => Object.values(cov.zones)
    .filter((r) => r.mappable && zoneMatch(r.zone, q) && (!onlyAttention || ["gap", "full", "thin"].includes(r.status)))
    .sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || b.demand.total - a.demand.total || a.zone.localeCompare(b.zone)), [cov, q, onlyAttention]);
  const counts = useMemo(() => {
    const c = { gap: 0, full: 0, thin: 0, ok: 0, idle: 0 };
    Object.values(cov.zones).forEach((r) => { if (r.mappable) c[r.status]++; });
    return c;
  }, [cov]);
  const sel = selected ? cov.zones[selected] : null;
  const T = cov.totals;
  const attention = counts.gap + counts.full + counts.thin;

  return (
    <div>
      <style>{`@keyframes gd-pulse{0%{box-shadow:0 0 0 0 rgba(192,57,43,.55)}80%,100%{box-shadow:0 0 0 14px rgba(192,57,43,0)}}
        .gd-bubble{background:none;border:none}.gd-tip{font:600 12px ${HEAD};border-radius:10px;border:1px solid ${C.line};box-shadow:0 6px 18px rgba(30,42,58,.18);color:${C.ink}}
        .leaflet-container{font-family:${HEAD}}`}</style>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
        <Kpi Icon={Stethoscope} label="Doctors on map" value={T.doctors} sub={cov.noZoneDoctors.length ? `${cov.noZoneDoctors.length} with no zone` : "all placed"} warn={cov.noZoneDoctors.length > 0} />
        <Kpi Icon={MapPin} label="Zones covered" value={`${T.zonesCovered}/${T.zonesTotal}`} sub={`${Math.round((T.zonesCovered / Math.max(1, T.zonesTotal)) * 100)}% of mapped zones`} />
        <Kpi Icon={Clock} label={`Open slots · ${HORIZON_DAYS}d`} value={T.open} sub={`${T.weekly} weekly · ${T.booked} booked`} />
        <Kpi Icon={Users} label="Waiting" value={T.demand} sub={T.unmappedDemand ? `${T.unmappedDemand} not pinnable` : "leads + patients + requests"} />
        <Kpi Icon={TriangleAlert} label="Need attention" value={attention} sub={`${counts.gap} uncovered · ${counts.full} full · ${counts.thin} thin`} warn={counts.gap > 0} onClick={() => setOnlyAttention((v) => !v)} active={onlyAttention} />
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white rounded-2xl px-3 py-2.5" style={{ border: `1px solid ${C.line}` }}>
        <div className="flex gap-1 overflow-x-auto">
          {["", ...DAY_NAMES].map((d) => (
            <button key={d || "all"} onClick={() => setFilter((f) => ({ ...f, day: d }))} className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold"
              style={{ background: filter.day === d ? C.ink : "transparent", color: filter.day === d ? "#fff" : C.grey }}>{d || "Any day"}</button>
          ))}
        </div>
        <select value={filter.band} onChange={(e) => setFilter((f) => ({ ...f, band: e.target.value }))} className="text-[13px] px-2.5 py-2 rounded-lg bg-white outline-none" style={{ border: `1px solid ${C.line}` }}>
          {Object.entries(BANDS).map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}
        </select>
        <select value={filter.doctor} onChange={(e) => setFilter((f) => ({ ...f, doctor: e.target.value }))} className="text-[13px] px-2.5 py-2 rounded-lg bg-white outline-none" style={{ border: `1px solid ${C.line}`, color: filter.doctor ? C.ink : C.grey }}>
          <option value="">All doctors</option>
          {doctors.map((d) => <option key={d.id ?? d.name} value={d.name}>{d.name}</option>)}
        </select>
        {(filter.day || filter.band !== "all" || filter.doctor) && <button onClick={() => setFilter({ day: "", band: "all", doctor: "" })} className="text-[12px] font-semibold px-2.5 py-1.5" style={{ color: C.grey }}>Reset</button>}
        <div className="ml-auto flex gap-1.5">
          <button onClick={showEgypt} className="px-3 py-1.5 rounded-lg text-[12px] font-bold" style={{ background: zoom < ZOOM_ZONES ? C.teal : "#fff", color: C.ink, border: `1px solid ${C.line}` }}>Egypt</button>
          <button onClick={showCairo} className="px-3 py-1.5 rounded-lg text-[12px] font-bold" style={{ background: zoom >= ZOOM_ZONES ? C.teal : "#fff", color: C.ink, border: `1px solid ${C.line}` }}>Greater Cairo</button>
        </div>
      </div>

      {/* map */}
      <div className="relative rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        <div ref={mapEl} role="application" aria-label="Doctor coverage map of Egypt" style={{ height: "min(62vh, 520px)", minHeight: 340, background: "#E9EEF0" }} />
        <div className="absolute left-2.5 bottom-6 z-[500] rounded-xl px-3 py-2 text-[11px]" style={{ background: "rgba(255,255,255,0.94)", border: `1px solid ${C.line}`, pointerEvents: "none" }}>
          <div className="font-bold uppercase tracking-wider mb-1" style={{ color: C.grey }}>Bubble = open slots · {HORIZON_DAYS}d</div>
          {zoom >= ZOOM_ZONES
            ? Object.entries(STATUS).map(([k, s]) => <div key={k} className="flex items-center gap-1.5 leading-[1.5]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color, border: k === "gap" || k === "idle" ? `1.5px dashed ${s.color}` : "none", opacity: k === "gap" || k === "idle" ? 0.9 : 1 }} />{s.label}<span style={{ color: C.grey }}>{counts[k]}</span></div>)
            : <div className="flex items-center gap-1.5"><Layers size={12} /> Zoom in to see zones · grey dot = no zones yet</div>}
        </div>
      </div>

      {/* list + detail */}
      <div className="grid md:grid-cols-5 gap-3 mt-3">
        <div className="md:col-span-3 bg-white rounded-2xl" style={{ border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
            <Search size={14} color={C.grey} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search zone · بحث بالعربي أو الإنجليزي" className="text-[13px] outline-none bg-transparent flex-1" style={{ color: C.ink }} />
            <span className="text-[11px]" style={{ color: C.grey }}>{rows.length} zones</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {rows.length === 0 && <div className="px-4 py-8 text-center text-[13px]" style={{ color: C.grey }}>{onlyAttention ? "Nothing needs attention with these filters." : `No zone matches “${q}”.`}</div>}
            {rows.map((r) => {
              const st = STATUS[r.status];
              return (
                <button key={r.zone} onClick={() => select(r.zone)} className="w-full text-left px-3 py-2.5 flex items-center gap-3" style={{ borderTop: `1px solid ${C.line}`, background: selected === r.zone ? "#F4FBFC" : "#fff", opacity: r.dim ? 0.45 : 1 }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: st.color }} title={st.label} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold truncate" style={{ color: C.ink }}>{r.zone}{ZONE_AR[r.zone] && <span className="font-normal" style={{ color: C.grey }}> · {ZONE_AR[r.zone]}</span>}</span>
                    <span className="block text-[11px] truncate" style={{ color: C.grey }}>{st.label} · {r.doctors.length} dr · {r.demand.total} waiting</span>
                  </span>
                  <span className="text-right shrink-0"><span className="block text-[14px] font-extrabold" style={{ color: C.ink, fontFamily: HEAD }}>{r.open}</span><span className="block text-[10px]" style={{ color: C.grey }}>of {r.weekly}/wk</span></span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-2">
          {!sel ? (
            <div className="bg-white rounded-2xl p-5 text-[13px]" style={{ border: `1px solid ${C.line}`, color: C.grey }}>
              <b style={{ color: C.ink }}>Pick a zone</b> on the map or list to see who covers it, which days have room, and who is waiting.
              <p className="mt-2 text-[12px]">Numbers for one zone can overlap with its neighbours — a doctor covering three zones can only be in one place per slot. The totals above count every slot once.</p>
            </div>
          ) : <ZoneDetail r={sel} doctors={doctors} onGoTab={onGoTab} />}
        </div>
      </div>
    </div>
  );
}

function Kpi({ Icon, label, value, sub, warn, onClick, active }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="text-left bg-white rounded-2xl px-3.5 py-3" style={{ border: `1px solid ${active ? C.ink : C.line}`, cursor: onClick ? "pointer" : "default" }}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: C.grey }}><Icon size={12} />{label}</div>
      <div className="text-[22px] font-extrabold leading-tight mt-0.5" style={{ color: warn ? C.red : C.ink, fontFamily: HEAD }}>{value}</div>
      <div className="text-[11px] truncate" style={{ color: warn ? C.red : C.grey }}>{sub}</div>
    </Tag>
  );
}

function ZoneDetail({ r, doctors, onGoTab }) {
  const st = STATUS[r.status];
  const docRows = r.doctors.map((n) => doctors.find((d) => d.name === n)).filter(Boolean);
  const shared = docRows.filter((d) => (d.zones || []).filter((z) => ZONE_GEO[z]).length > 1);
  const maxDay = Math.max(1, ...DAY_NAMES.map((d) => r.byDay[d]));
  return (
    <div className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${C.line}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[16px] font-extrabold truncate" style={{ fontFamily: HEAD, color: C.ink }}>{r.zone}</h3>
          <div className="text-[12px]" style={{ color: C.grey }}>{ZONE_AR[r.zone] && <>{ZONE_AR[r.zone]} · </>}{r.gov}</div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0" style={{ background: st.color + "22", color: r.status === "idle" ? C.grey : st.color }}>{st.label}</span>
      </div>
      <p className="text-[12px] mt-1.5" style={{ color: C.ink2 }}>{r.reason}.</p>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {[["Open · 7d", r.open], ["Weekly", r.weekly], ["Booked · 7d", r.booked]].map(([l, v]) => (
          <div key={l} className="rounded-xl px-2.5 py-2" style={{ background: C.bg }}><div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.grey }}>{l}</div><div className="text-[18px] font-extrabold" style={{ fontFamily: HEAD, color: C.ink }}>{v}</div></div>
        ))}
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.grey }}>Slots by day (open of weekly)</div>
        <div className="grid grid-cols-7 gap-1.5 items-end" style={{ height: 64 }}>
          {DAY_NAMES.map((d) => {
            const w = r.byDay[d], o = r.openByDay[d], h = w ? Math.max(8, (w / maxDay) * 44) : 3;
            return (
              <div key={d} className="flex flex-col items-center justify-end h-full" title={`${d}: ${o} open of ${w} weekly`}>
                <div className="w-full rounded-md relative overflow-hidden" style={{ height: h, background: w ? "#DDE5E9" : C.line }}>
                  {w > 0 && <div className="absolute bottom-0 left-0 right-0" style={{ height: `${(Math.min(o, w) / w) * 100}%`, background: C.teal }} />}
                </div>
                <div className="text-[10px] mt-1 font-semibold" style={{ color: w ? C.ink2 : C.grey }}>{d[0]}{w ? <span style={{ color: C.grey }}> {w}</span> : null}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.grey }}>Doctors ({docRows.length})</div>
        {docRows.length === 0 && <div className="text-[12px]" style={{ color: C.grey }}>Nobody covers this zone.</div>}
        {docRows.map((d) => {
          const extra = (d.zones || []).filter((z) => z !== r.zone && ZONE_GEO[z]).length;
          return (
            <div key={d.name} className="flex items-center justify-between py-1.5 text-[13px]" style={{ borderTop: `1px solid ${C.line}` }}>
              <span><b style={{ color: C.ink }}>{d.name}</b> <span style={{ color: C.grey }}>{d.spec}</span></span>
              <span className="text-[11px]" style={{ color: C.grey }}>{(d.slots || []).length} slots/wk{extra > 0 && ` · +${extra} zone${extra > 1 ? "s" : ""}`}</span>
            </div>
          );
        })}
        {shared.length > 0 && <p className="text-[11px] mt-1" style={{ color: C.grey }}>{shared.map((d) => d.name).join(", ")} {shared.length === 1 ? "also works" : "also work"} other zones, so these slots are shared.</p>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {[["patients", "active patients"], ["leads", "leads"], ["requests", "booking requests"], ["unassigned", "without a doctor"]].map(([k, l]) => (
          <span key={k} className="px-2 py-1 rounded-full font-semibold" style={{ background: C.bg, color: C.ink2 }}>{r.demand[k]} {l}</span>
        ))}
      </div>

      {onGoTab && <button onClick={() => onGoTab("doctors")} className="mt-3 w-full py-2.5 rounded-xl text-[13px] font-bold" style={{ background: C.ink, color: "#fff" }}>{r.status === "gap" ? "Find a doctor for this zone →" : "Manage doctors & availability →"}</button>}
    </div>
  );
}
