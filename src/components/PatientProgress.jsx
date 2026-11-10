import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

/* Public, no-login patient progress page: go-doc-sys.vercel.app/p/<token>
 * Reads ONLY through the patient_progress(token) SQL function (whitelisted DTO). */

const C = {
  ink: '#0F2A2E', teal: '#2E6E73', tealL: '#3FB6A8', soft: '#A9D9D1',
  bg: '#F4F1EA', card: '#ffffff', line: '#E3E7E5', grey: '#6B7A7E',
  green: '#2F9E6F', amber: '#C98A2B', red: '#C0564A',
}
const NEURO = /cidp|stroke|cva|hemipleg|parkinson|neuro|gbs|guillain|\bms\b|multiple sclerosis|demyelinat|spinal cord|parapleg|quadripleg|tetrapleg|palsy|myopathy|neuropath|ataxia/i

// Go Doc clinic WhatsApp (international format, no +). The floating "contact us"
// button on the patient page opens a chat with this number.
const CLINIC_WA = '201509959866'

// WhatsApp glyph (inline so the public page carries no icon dependency)
function WhatsAppGlyph({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.556-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.82 9.82 0 001.517 5.248l-.999 3.648 3.971-1.043zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  )
}

export function patientToken() {
  if (typeof window === 'undefined') return null
  const m = window.location.pathname.match(/^\/p\/([A-Za-z0-9_-]{8,})\/?$/)
  if (m) return m[1]
  const h = (window.location.hash || '').match(/^#\/?p\/([A-Za-z0-9_-]{8,})\/?$/)
  return h ? h[1] : null
}

const fmtDate = (iso, lang) => {
  if (!iso) return ''
  try { return new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }) }
  catch { return iso }
}
const to12 = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number); if (isNaN(h)) return t
  const ap = h < 12 ? 'ص' : 'م'; const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ap}`
}

const shortDate = (iso, lang) => {
  if (!iso) return ''
  try { return new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-EG', { day: 'numeric', month: 'short' }) }
  catch { return iso }
}

// Light dir-aware SVG line chart. Tap anywhere to read the value at the nearest
// session. points: [{n, v, date}]. yMax sets the scale (pain: lower = better).
function Chart({ points, yMax, rtl, color, caption, en, unit, lang }) {
  const [sel, setSel] = useState(null)
  const W = 320, H = 158, padX = 28, padTop = 20, padBot = 16
  if (!points.length) return null
  const innerH = H - padTop - padBot
  const n = points.length
  const xs = (i) => { const t = n === 1 ? 0.5 : i / (n - 1); const tt = rtl ? 1 - t : t; return padX + tt * (W - padX * 2) }
  const ys = (v) => padTop + innerH - (Math.max(0, Math.min(yMax, v)) / yMax) * innerH
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ')
  const area = `${path} L${xs(n - 1).toFixed(1)},${padTop + innerH} L${xs(0).toFixed(1)},${padTop + innerH} Z`
  const lastI = n - 1
  const avg = points.reduce((a, p) => a + p.v, 0) / n
  const avgY = ys(avg)
  const ticks = [0, yMax / 2, yMax]
  const selI = sel == null ? lastI : sel
  const sp = points[selI], spx = xs(selI), spy = ys(sp.v)

  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left
    let frac = r.width ? cx / r.width : 0
    if (rtl) frac = 1 - frac
    const span = (W - padX * 2) / W, start = padX / W
    let t = (frac - start) / span
    t = Math.max(0, Math.min(1, t))
    setSel(Math.round(t * (n - 1)))
  }

  // tooltip geometry
  const tpTxt = `${en ? 'pain' : 'ألم'} ${sp.v}${unit || ''}`
  const dTxt = shortDate(sp.date, lang)
  const tw = Math.max(58, tpTxt.length * 6.6, dTxt.length * 6.2) + 14
  let tx = spx - tw / 2; tx = Math.max(2, Math.min(W - tw - 2, tx))
  let ty = spy - 42; const below = ty < 2; if (below) ty = spy + 12
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={caption}
      onPointerDown={pick} onPointerMove={(e) => { if (e.buttons) pick(e) }}
      style={{ display: 'block', overflow: 'visible', cursor: 'pointer', touchAction: 'none' }}>
      <defs>
        <linearGradient id="chArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.16" />
          <stop offset="1" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* horizontal gridlines + y-axis labels */}
      {ticks.map((t, k) => (
        <g key={k}>
          <line x1={padX} x2={W - padX} y1={ys(t)} y2={ys(t)} stroke="#EFEDE7" strokeWidth="1" />
          <text x={W - padX + 5} y={ys(t) + 3} fill="#C2C9CB" fontSize="9" textAnchor="start">{Math.round(t)}</text>
        </g>
      ))}
      {/* average line + pill */}
      <line x1={padX} x2={W - padX} y1={avgY} y2={avgY} stroke={color} strokeWidth="1.2" strokeDasharray="4 5" opacity="0.4" />
      <rect x={W / 2 - 30} y={avgY - 9} width="60" height="18" rx="9" fill="#fff" stroke={color} strokeOpacity="0.4" />
      <text x={W / 2} y={avgY + 3.5} fill={color} fontSize="9.5" fontWeight="800" textAnchor="middle">{en ? `Avg ${avg.toFixed(0)}` : `متوسط ${avg.toFixed(0)}`}</text>
      {/* light area + line */}
      <path d={area} fill="url(#chArea)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.92" />
      {/* selected marker + guide + tooltip */}
      <line x1={spx} x2={spx} y1={padTop} y2={padTop + innerH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
      <circle cx={spx} cy={spy} r="5.5" fill={color} stroke="#fff" strokeWidth="2.5" />
      <g>
        <rect x={tx} y={ty} width={tw} height="30" rx="8" fill={C.ink} />
        <text x={tx + tw / 2} y={ty + 13} fill="#fff" fontSize="11" fontWeight="800" textAnchor="middle">{tpTxt}</text>
        <text x={tx + tw / 2} y={ty + 24} fill="#C9D2D1" fontSize="8.5" textAnchor="middle">{dTxt}</text>
      </g>
    </svg>
  )
}

// Neuro / function view: an independence gauge (0→100 toward "on your own") + a
// rising filled trend. Framed around GAINS going up, unlike the pain line.
function FunctionViz({ points, first, last, en, rtl }) {
  const bands = en ? ['A lot of help', 'Some help', 'A little help', 'On your own']
                   : ['مساعدة كبيرة', 'مساعدة متوسطة', 'مساعدة بسيطة', 'استقلالية']
  if (!points.length) {
    return (
      <div style={{ textAlign: 'center', padding: '14px 8px' }}>
        <div style={{ fontSize: 34 }}>🌱</div>
        <div style={{ fontSize: 13, color: C.grey, marginTop: 6, lineHeight: 1.7 }}>
          {en ? "We'll start tracking your independence from your next session — you'll see it climb here."
              : 'هنبدأ نقيس استقلاليتك من الجلسة الجاية — وهتشوفها بتزيد هنا خطوة بخطوة.'}
        </div>
      </div>
    )
  }
  const pct = Math.max(0, Math.min(100, last ?? 0))
  const W = 320, H = 96, pad = 18
  const xs = (i) => { const t = points.length === 1 ? 1 : i / (points.length - 1); const tt = rtl ? 1 - t : t; return pad + tt * (W - pad * 2) }
  const ys = (v) => H - 14 - (v / 100) * (H - 28)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ')
  const area = points.length >= 2 ? `${line} L${xs(points.length - 1)},${H - 14} L${xs(0)},${H - 14} Z` : ''
  return (
    <div>
      {/* big current level */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 42, fontWeight: 800, color: C.green, fontFamily: 'Georgia, serif', lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 13, color: C.grey }}>{en ? 'independence now' : 'استقلاليتك دلوقتي'}</span>
      </div>
      {/* segmented gauge, always LTR 0→100 */}
      <div dir="ltr" style={{ position: 'relative', height: 16, borderRadius: 999, background: '#ECE6DA', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, left: 0, width: `${pct}%`, background: `linear-gradient(90deg, ${C.soft}, ${C.green})`, borderRadius: 999, transition: 'width .4s' }} />
        {[25, 50, 75].map((t) => <div key={t} style={{ position: 'absolute', top: 0, bottom: 0, left: `${t}%`, width: 2, background: '#F4F1EA' }} />)}
      </div>
      <div dir="ltr" style={{ display: 'flex', marginTop: 4 }}>
        {bands.map((b, i) => <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: C.grey }}>{b}</span>)}
      </div>
      {/* rising trend */}
      {points.length >= 2 && (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={en ? 'independence trend' : 'تطور الاستقلالية'} style={{ display: 'block', marginTop: 12 }}>
          <defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.green} stopOpacity="0.28" /><stop offset="1" stopColor={C.green} stopOpacity="0.02" /></linearGradient></defs>
          {area && <path d={area} fill="url(#fg)" />}
          <path d={line} fill="none" stroke={C.green} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => <circle key={i} cx={xs(i)} cy={ys(p.v)} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? C.green : '#fff'} stroke={C.green} strokeWidth="2" />)}
        </svg>
      )}
      <div style={{ fontSize: 11, color: C.grey, textAlign: 'center', marginTop: 4 }}>
        {en ? 'higher = more independent · by session' : 'رقم أعلى = استقلالية أكتر · بالجلسة'}
      </div>
    </div>
  )
}

export default function PatientProgress() {
  const token = patientToken()
  const [lang, setLang] = useState('ar')
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [metricPick, setMetricPick] = useState(null)   // active progress tab: 'pain' | 'function'
  const [allView, setAllView] = useState(false)        // full "all sessions" screen
  const [sheet, setSheet] = useState(null)             // { s, num } open in the detail sheet

  useEffect(() => {
    let on = true
    if (!token) { setState({ loading: false, data: null, error: 'notoken' }); return }
    supabase.rpc('patient_progress', { p_token: token }).then(({ data, error }) => {
      if (!on) return
      if (error) setState({ loading: false, data: null, error: error.message })
      else setState({ loading: false, data, error: data ? null : 'notfound' })
    })
    return () => { on = false }
  }, [token])

  const d = state.data
  const track = useMemo(() => {
    if (!d) return 'pain'
    return d.track || (NEURO.test(d.diagnosis || '') ? 'function' : 'pain')
  }, [d])

  const en = lang === 'en'
  const fem = d && (d.gender === 'Female' || d.gender === 'أنثى')
  const dir = en ? 'ltr' : 'rtl'

  if (state.loading) return <Shell dir="rtl"><div style={{ textAlign: 'center', padding: 60, color: C.grey }}>…</div></Shell>
  if (!d) return <NotFound />

  // build a per-metric series (each session's value for that metric, in order)
  const buildSeries = (which) => {
    const arr = (d.sessions || [])
      .map((s) => (which === 'pain' ? s.pain : s.progress))
      .map((v) => (v === null || v === undefined ? null : Number(v)))
    const present = arr.map((v, i) => ({ v, i })).filter((x) => x.v !== null && !isNaN(x.v))
    return { present, first: present.length ? present[0].v : null, last: present.length ? present[present.length - 1].v : null, points: present.map((x, k) => ({ n: k + 1, v: x.v, date: (d.sessions[x.i] || {}).date })) }
  }
  const painS = buildSeries('pain')
  const funcS = buildSeries('function')

  // neuro patients carry BOTH measures (pain + independence) as filter tabs;
  // ortho shows pain only. Default to the measure that already has data.
  const isNeuro = track === 'function'
  const metricTabs = isNeuro ? ['function', 'pain'] : ['pain']
  const defaultMetric = isNeuro ? (funcS.present.length ? 'function' : 'pain') : 'pain'
  const metric = metricTabs.includes(metricPick) ? metricPick : defaultMetric
  const { present, first, last, points } = metric === 'pain' ? painS : funcS

  const done = (d.sessions || []).length
  const clean = (s) => (s && String(s).trim() ? String(s).trim() : null)   // treat '' as missing
  const nvDate = d.nextVisit && clean(d.nextVisit.date)
  const nnDate = clean(d.nextNoteDate)
  const next = nvDate ? { date: nvDate, time: clean(d.nextVisit.time), physio: d.nextVisit.physio, hasTime: !!clean(d.nextVisit.time) }
    : (nnDate ? { date: nnDate, time: null, physio: d.physio, hasTime: false } : null)

  // headline for the active measure
  let headline, tone = 'neutral'
  if (metric === 'pain') {
    const delta = first != null && last != null ? first - last : null
    if (present.length === 0) headline = en ? "We'll start tracking pain from your first session" : 'هنبدأ نقيس الألم من أول جلسة'
    else if (present.length === 1) headline = en ? `Starting point: pain ${last}/10` : `نقطة البداية: الألم ${last} من 10`
    else if (delta >= 2) { headline = en ? `Pain went down from ${first} to ${last}` : `الألم نزل من ${first} لـ ${last}`; tone = 'good' }
    else if (Math.abs(delta) < 2) headline = en ? `Pain is steady around ${last}` : `الألم ثابت تقريباً عند ${last}`
    else { headline = en ? `Pain went up from ${first} to ${last} — your physio is on it` : `الألم زاد من ${first} لـ ${last} — دكتورك متابع معاك`; tone = 'amber' }
  } else {
    const delta = first != null && last != null ? last - first : null
    if (present.length === 0) headline = en ? "We'll start measuring your independence from your first rated session" : 'هنبدأ نقيس استقلاليتك من أول جلسة تتقيّم'
    else if (present.length === 1) headline = en ? `Starting point: ${last}%` : `نقطة البداية: ${last}%`
    else if (delta >= 10) { headline = en ? `Your independence improved from ${first}% to ${last}%` : `استقلاليتك اتحسنت من ${first}% لـ ${last}%`; tone = 'good' }
    else if (Math.abs(delta) < 10) headline = en ? `Your independence is steady at ${last}%` : `استقلاليتك ثابتة عند ${last}%`
    else { headline = en ? `A small dip — your physio is adjusting the plan` : `في تراجع بسيط — دكتورك بيعدّل الخطة معاك`; tone = 'amber' }
  }
  const toneColor = tone === 'good' ? C.green : tone === 'amber' ? C.amber : C.ink

  const greet = en ? `Hi ${d.firstName}` : `أهلاً يا ${d.firstName}`
  const last5 = (d.sessions || []).slice().reverse()

  return (
    <>
      <Shell dir={dir}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, color: C.ink }}>Go Doc</div>
        <button onClick={() => setLang(en ? 'ar' : 'en')} style={{ fontSize: 12, fontWeight: 700, color: C.teal, background: '#fff', border: `1px solid ${C.soft}`, borderRadius: 999, padding: '4px 12px', cursor: 'pointer' }}>{en ? 'عربي' : 'EN'}</button>
      </div>

      {/* greeting */}
      <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, fontFamily: 'Georgia, serif' }}>{greet} 👋</div>
      <div style={{ fontSize: 13, color: C.grey, marginTop: 2 }}>
        {[d.diagnosis, d.physio ? `${en ? 'with Dr. ' : 'مع د. '}${d.physio}` : null].filter(Boolean).join(' · ')}
      </div>

      {/* next session */}
      {next && (
        <Card accent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(46,110,115,.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📅</span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.teal, textTransform: 'uppercase' }}>{en ? 'Next session' : 'جلستك الجاية'}</span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>
            {fmtDate(next.date, lang)}{next.hasTime ? ` · ${en ? next.time : to12(next.time)}` : ''}
          </div>
          {next.physio && <div style={{ fontSize: 13, color: C.grey, marginTop: 2 }}>{en ? `with Dr. ${next.physio}` : `مع د. ${next.physio}`}</div>}
          {!next.hasTime && <div style={{ fontSize: 12, color: C.amber, marginTop: 4 }}>{en ? "we'll confirm the time with you" : 'هنأكد معاك الميعاد'}</div>}
        </Card>
      )}

      {/* progress */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.teal, textTransform: 'uppercase' }}>{en ? 'Your progress' : 'تقدمك'}</div>
          {metricTabs.length > 1 && (
            <div style={{ display: 'inline-flex', background: '#EEF3F2', borderRadius: 999, padding: 3, gap: 2 }}>
              {metricTabs.map((m) => {
                const on = metric === m
                const label = m === 'pain' ? (en ? 'Pain' : 'الألم') : (en ? 'Independence' : 'الاستقلالية')
                return (
                  <button key={m} onClick={() => setMetricPick(m)} style={{ fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? C.ink : C.grey, boxShadow: on ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{label}</button>
                )
              })}
            </div>
          )}
        </div>
        {tone !== 'neutral' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 8, padding: '4px 10px 4px 7px', borderRadius: 999, background: tone === 'good' ? 'rgba(47,158,111,.12)' : 'rgba(201,138,43,.14)' }}>
            <span style={{ width: 16, height: 16, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: tone === 'good' ? C.green : C.amber, color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>{tone === 'good' ? '↗' : '↘'}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: tone === 'good' ? C.green : C.amber }}>{tone === 'good' ? (en ? 'Improving' : 'في تحسّن') : (en ? 'Keep an eye' : 'محتاجة متابعة')}</span>
          </div>
        )}
        <div style={{ fontSize: 17, fontWeight: 800, color: toneColor, marginBottom: 10, lineHeight: 1.5 }}>{headline}</div>
        {metric === 'function'
          ? <FunctionViz points={points} first={first} last={last} en={en} rtl={!en} />
          : (points.length >= 1
            ? <>
                <Chart points={points} yMax={10} rtl={!en} color={toneColor === C.ink ? C.teal : toneColor} caption={headline} en={en} unit="/10" lang={lang} />
                <div style={{ fontSize: 11, color: C.grey, textAlign: 'center', marginTop: 2 }}>{en ? 'lower = less pain · by session' : 'رقم أقل = ألم أقل · بالجلسة'}</div>
              </>
            : <div style={{ fontSize: 12.5, color: C.grey, textAlign: 'center', padding: '14px 0' }}>{en ? "We'll start tracking pain from your first session." : 'هنبدأ نقيس الألم من أول جلسة.'}</div>)}
      </Card>

      {/* sessions done — tap a session to open its full detail sheet */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 4 }}>{en ? `Sessions done (${done})` : `الجلسات اللي ${fem ? 'خلصتيها' : 'خلصتها'} (${done})`}</div>
        <div style={{ fontSize: 12, color: C.grey, marginBottom: 8 }}>{en ? 'Tap any session to see everything your physio recorded.' : 'دوس على أي جلسة تشوف كل اللي سجّله دكتورك فيها.'}</div>
        {last5.slice(0, 6).map((s, i) => (
          <SessionRow key={i} s={s} num={done - i} metric={metric} lang={lang} en={en} border={!!i} onOpen={(ss, n) => setSheet({ s: ss, num: n })} />
        ))}
        {done > 6 && (
          <button onClick={() => setAllView(true)} style={{ width: '100%', marginTop: 10, padding: '10px 0', fontSize: 12.5, fontWeight: 700, color: C.teal, background: '#F4FBFC', border: `1px solid ${C.soft}`, borderRadius: 12, cursor: 'pointer' }}>
            {en ? `Show all ${done} sessions` : `عرض كل الجلسات (${done})`}
          </button>
        )}
      </Card>

        <div style={{ textAlign: 'center', fontSize: 11.5, color: C.grey, marginTop: 14, lineHeight: 1.7 }}>
          {en ? 'This page is private to you — please don’t share it.' : 'الصفحة دي خاصة بيك — متشاركهاش.'}
        </div>
        <div style={{ height: 64 }} aria-hidden="true" />
      </Shell>

      {allView && (
        <AllSessions sessions={last5} done={done} metric={metric} lang={lang} en={en} fem={fem}
          onOpen={(ss, n) => setSheet({ s: ss, num: n })} onClose={() => setAllView(false)} />
      )}
      {sheet && <SessionSheet s={sheet.s} num={sheet.num} lang={lang} en={en} onClose={() => setSheet(null)} />}

      {/* floating WhatsApp — contact the clinic directly */}
      {!sheet && (
        <a
          href={`https://wa.me/${CLINIC_WA}?text=${encodeURIComponent(en ? `Hi, I'm ${d.firstName} — I'd like to get in touch about my Go Doc sessions.` : `مرحبا، أنا ${d.firstName} 👋 حابب أتواصل معاكم بخصوص جلساتي في Go Doc.`)}`}
          target="_blank" rel="noreferrer"
          aria-label={en ? 'Contact us on WhatsApp' : 'تواصل معانا على واتساب'}
          style={{ position: 'fixed', bottom: 18, insetInlineEnd: 16, zIndex: 56, display: 'inline-flex', alignItems: 'center', gap: 9, background: '#25D366', color: '#fff', borderRadius: 999, padding: '12px 18px', boxShadow: '0 8px 22px rgba(37,211,102,.38)', textDecoration: 'none', fontWeight: 800, fontSize: 14, fontFamily: "'IBM Plex Sans Arabic','Tajawal',system-ui,sans-serif" }}
        >
          <WhatsAppGlyph size={21} />
          <span>{en ? 'Contact us' : 'تواصل معانا'}</span>
        </a>
      )}
    </>
  )
}

/* One row in a session list → opens the detail sheet. */
function SessionRow({ s, num, metric, lang, en, border, onOpen }) {
  const chipVal = metric === 'pain'
    ? (s.pain != null ? `${en ? 'pain' : 'ألم'} ${s.pain}/10` : null)
    : (s.progress != null ? `${s.progress}%` : null)
  return (
    <button onClick={() => onOpen(s, num)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '11px 0', background: 'none', border: 'none', borderTop: border ? `1px solid ${C.line}` : 'none', textAlign: en ? 'left' : 'right', cursor: 'pointer', font: 'inherit' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.teal, background: '#EAF6F4', borderRadius: 8, padding: '2px 7px', whiteSpace: 'nowrap' }}>{en ? `#${num}` : `جلسة ${num}`}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' }}>{fmtDate(s.date, lang)}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        {chipVal && <span style={{ fontSize: 11, fontWeight: 700, color: C.teal, background: '#EAF6F4', borderRadius: 999, padding: '2px 9px' }}>{chipVal}</span>}
        <span style={{ fontSize: 17, color: '#B8C2C9', lineHeight: 1 }}>{en ? '›' : '‹'}</span>
      </span>
    </button>
  )
}

/* Full-screen "all sessions" page. */
function AllSessions({ sessions, done, metric, lang, en, fem, onOpen, onClose }) {
  return (
    <div dir={en ? 'ltr' : 'rtl'} style={{ position: 'fixed', inset: 0, zIndex: 55, background: '#F4F1EA', overflowY: 'auto', fontFamily: "'IBM Plex Sans Arabic','Tajawal',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 90px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 700, color: C.teal, background: '#fff', border: `1px solid ${C.soft}`, borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}>{en ? '‹ Back' : 'رجوع ›'}</button>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.ink, fontFamily: 'Georgia, serif' }}>{en ? `All sessions (${done})` : `كل الجلسات (${done})`}</div>
        </div>
        <Card>
          {sessions.map((s, i) => (
            <SessionRow key={i} s={s} num={done - i} metric={metric} lang={lang} en={en} border={!!i} onOpen={onOpen} />
          ))}
        </Card>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: C.grey, marginTop: 14 }}>
          {en ? 'This page is private to you — please don’t share it.' : 'الصفحة دي خاصة بيك — متشاركهاش.'}
        </div>
      </div>
    </div>
  )
}

const RESP_AR = { better: 'تحسّن', same: 'زي ما هي', mixed: 'متفاوتة', worse: 'أسوأ' }
const TYPE_AR = { Assessment: 'تقييم', Treatment: 'علاج', 'Re-assessment': 'إعادة تقييم', Reassessment: 'إعادة تقييم', Consultation: 'استشارة', Discharge: 'إنهاء علاج' }

/* Bottom sheet — the full session, everything the doctor recorded. */
function SessionSheet({ s, num, lang, en, onClose }) {
  const typeLabel = en ? s.type : (TYPE_AR[s.type] || s.type)
  const resp = s.response ? (en ? s.response : (RESP_AR[s.response] || s.response)) : null
  const painBefore = s.painBefore != null ? s.painBefore : (s.pain != null ? s.pain : null)  // fallback for old RPC
  const summary = (s.summary && String(s.summary).trim()) ? s.summary : (s.note || '')
  const list = (arr) => Array.isArray(arr) ? arr.filter(Boolean) : []
  const ex = list(s.exercises), mod = list(s.modalities)
  // narrative sections the doctor wrote, in reading order (patient-friendly labels)
  const sections = [
    ['subjective', en ? 'What you reported' : 'اللي اشتكيت منه', s.subjective],
    ['objective', en ? 'Examination' : 'اللي لقيناه في الفحص', s.objective],
    ['measures', en ? 'Measurements' : 'القياسات', s.measures],
    ['assessment', en ? 'Assessment' : 'تقييم الحالة', s.assessment],
    ['goals', en ? 'Goals' : 'الأهداف', s.goals],
    ['hep', en ? 'Home exercises' : 'تمارين تعملها في البيت', s.hep],
    ['education', en ? 'Advice' : 'نصايح وإرشادات', s.education],
    ['plan', en ? 'Next steps' : 'الخطة الجاية', s.plan],
    ['additionalNotes', en ? 'More notes' : 'ملاحظات إضافية', s.additionalNotes],
  ].filter(([, , v]) => v && String(v).trim())
  const stop = (e) => e.stopPropagation()
  const Stat = ({ label, value }) => (
    <div style={{ flex: '1 1 90px', background: '#fff', border: '1px solid rgba(227,231,229,.7)', borderRadius: 16, padding: '11px 13px', boxShadow: '0 1px 2px rgba(16,42,46,.04), 0 6px 16px rgba(16,42,46,.04)' }}>
      <div style={{ fontSize: 11, color: C.grey, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: C.ink }}>{value}</div>
    </div>
  )
  const Section = ({ label, children }) => (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, color: C.teal, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
  const anyMetric = painBefore != null || s.painAfter != null || s.progress != null || resp
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,30,30,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={stop} dir={en ? 'ltr' : 'rtl'} style={{ width: '100%', maxWidth: 480, background: 'linear-gradient(180deg, #FBF3EC 0%, #F6F1EA 120px)', borderRadius: '24px 24px 0 0', padding: '10px 18px 26px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 -10px 34px rgba(16,42,46,.2)', fontFamily: "'IBM Plex Sans Arabic','Tajawal',system-ui,sans-serif" }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: '#CBD3D2', margin: '4px auto 16px' }} />
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: C.ink, fontFamily: 'Georgia, serif' }}>{en ? `Session #${num}` : `جلسة ${num}`}</div>
          {typeLabel && <span style={{ fontSize: 12, fontWeight: 700, color: C.teal, background: '#EAF6F4', borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>{typeLabel}</span>}
        </div>
        <div style={{ fontSize: 14, color: C.grey, marginTop: 2 }}>{fmtDate(s.date, lang)}{s.doctor ? ` · ${en ? 'Dr. ' : 'د. '}${s.doctor}` : ''}</div>

        {/* metrics */}
        {anyMetric && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {painBefore != null && <Stat label={en ? 'Pain before' : 'الألم قبل'} value={`${painBefore}/10`} />}
            {s.painAfter != null && <Stat label={en ? 'Pain after' : 'الألم بعد'} value={`${s.painAfter}/10`} />}
            {s.progress != null && <Stat label={en ? 'Independence' : 'الاستقلالية'} value={`${s.progress}%`} />}
            {resp && <Stat label={en ? 'Response' : 'الاستجابة'} value={resp} />}
          </div>
        )}

        {/* exercises / modalities */}
        {(ex.length > 0 || mod.length > 0) && (
          <Section label={en ? 'What we did' : 'اللي عملناه في الجلسة'}>
            {ex.length > 0 && (
              <div style={{ marginBottom: mod.length ? 8 : 0 }}>
                {mod.length > 0 && <div style={{ fontSize: 12, color: C.grey, marginBottom: 4 }}>{en ? 'Exercises' : 'تمارين'}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ex.map((e, k) => <span key={k} style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, background: '#fff', border: '1px solid rgba(227,231,229,.8)', borderRadius: 11, padding: '6px 11px', boxShadow: '0 1px 2px rgba(16,42,46,.04)' }}>{typeof e === 'string' ? e : (e.name || '')}</span>)}
                </div>
              </div>
            )}
            {mod.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: C.grey, marginBottom: 4 }}>{en ? 'Modalities' : 'أجهزة ووسائل علاجية'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {mod.map((e, k) => <span key={k} style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, background: '#fff', border: '1px solid rgba(227,231,229,.8)', borderRadius: 11, padding: '6px 11px', boxShadow: '0 1px 2px rgba(16,42,46,.04)' }}>{typeof e === 'string' ? e : (e.name || '')}</span>)}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* narrative sections */}
        {sections.map(([key, label, val]) => (
          <Section key={key} label={label}>
            <div dir="auto" style={{ fontSize: 14, lineHeight: 1.9, color: C.ink, whiteSpace: 'pre-line' }}>{val}</div>
          </Section>
        ))}

        {/* plain-language summary */}
        {summary && String(summary).trim() && (
          <Section label={en ? 'In short' : 'باختصار'}>
            <div dir="auto" style={{ fontSize: 14, lineHeight: 1.9, color: C.ink, whiteSpace: 'pre-line', background: '#EAF6F4', borderRadius: 12, padding: '10px 12px' }}>{summary}</div>
          </Section>
        )}

        {!anyMetric && ex.length === 0 && mod.length === 0 && sections.length === 0 && !(summary && String(summary).trim()) && (
          <div style={{ fontSize: 13.5, color: C.grey, marginTop: 16 }}>{en ? 'No details were recorded for this session.' : 'مفيش تفاصيل متسجّلة للجلسة دي.'}</div>
        )}

        <button onClick={onClose} style={{ width: '100%', marginTop: 20, padding: '12px 0', fontSize: 14, fontWeight: 700, color: '#fff', background: C.ink, border: 'none', borderRadius: 14, cursor: 'pointer' }}>{en ? 'Close' : 'تمام'}</button>
      </div>
    </div>
  )
}

function Shell({ children, dir }) {
  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#ECECEE', display: 'flex', justifyContent: 'center', fontFamily: "'IBM Plex Sans Arabic','Tajawal',system-ui,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 480, minHeight: '100vh', padding: '22px 16px 28px', background: 'radial-gradient(130% 62% at 50% -6%, #FBEEE6 0%, #F7F1E9 40%, #F4F1EA 100%)' }}>{children}</div>
    </div>
  )
}
function Card({ children, accent }) {
  return <div style={{ background: '#fff', border: `1px solid ${accent ? '#BFE3DC' : 'rgba(227,231,229,.8)'}`, borderRadius: 22, padding: 17, marginTop: 14, boxShadow: '0 1px 2px rgba(16,42,46,.04), 0 10px 26px rgba(16,42,46,.045)' }}>{children}</div>
}
function NotFound() {
  return (
    <Shell dir="rtl">
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 24, color: '#0F2A2E', marginBottom: 12 }}>Go Doc</div>
        <div style={{ fontSize: 15, color: '#6B7A7E', lineHeight: 1.8 }}>الرابط ده مش شغّال — كلمنا على واتساب ونبعتلك رابط جديد.</div>
      </div>
    </Shell>
  )
}
