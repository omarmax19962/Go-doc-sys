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

// Small dir-aware SVG line chart. values: array of {n, v}. yMax, invertGood for pain (lower=better).
function Chart({ points, yMax, rtl, color, caption }) {
  const W = 320, H = 150, pad = 26
  if (!points.length) return null
  const xs = (i) => {
    const t = points.length === 1 ? 0.5 : i / (points.length - 1)
    const tt = rtl ? 1 - t : t
    return pad + tt * (W - pad * 2)
  }
  const ys = (v) => H - pad - (v / yMax) * (H - pad * 2)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const lastI = points.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={caption} style={{ display: 'block' }}>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={pad} x2={W - pad} y1={pad + g * (H - pad * 2)} y2={pad + g * (H - pad * 2)} stroke={C.line} strokeWidth="1" />
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xs(i)} cy={ys(p.v)} r={i === lastI ? 5 : 3} fill={i === lastI ? color : '#fff'} stroke={color} strokeWidth="2" />
      ))}
      <text x={xs(lastI)} y={ys(last.v) - 9} fill={C.ink} fontSize="13" fontWeight="800" textAnchor="middle">{last.v}</text>
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
  const [showAll, setShowAll] = useState(false)
  const [openSet, setOpenSet] = useState({})

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

  // build series
  const series = (d.sessions || [])
    .map((s) => (track === 'pain' ? s.pain : s.progress))
    .map((v) => (v === null || v === undefined ? null : Number(v)))
  const present = series.map((v, i) => ({ v, i })).filter((x) => x.v !== null && !isNaN(x.v))
  const first = present.length ? present[0].v : null
  const last = present.length ? present[present.length - 1].v : null
  const points = present.map((x, k) => ({ n: k + 1, v: x.v }))

  const done = (d.sessions || []).length
  const clean = (s) => (s && String(s).trim() ? String(s).trim() : null)   // treat '' as missing
  const nvDate = d.nextVisit && clean(d.nextVisit.date)
  const nnDate = clean(d.nextNoteDate)
  const next = nvDate ? { date: nvDate, time: clean(d.nextVisit.time), physio: d.nextVisit.physio, hasTime: !!clean(d.nextVisit.time) }
    : (nnDate ? { date: nnDate, time: null, physio: d.physio, hasTime: false } : null)

  // headline
  let headline, tone = 'neutral'
  if (track === 'pain') {
    const delta = first != null && last != null ? first - last : null
    if (present.length === 0) headline = en ? "We'll start tracking from your first session" : 'هنبدأ نتابع الألم من أول جلسة'
    else if (present.length === 1) headline = en ? `Starting point: pain ${last}/10` : `نقطة البداية: الألم ${last} من 10`
    else if (delta >= 2) { headline = en ? `Pain went down from ${first} to ${last}` : `الألم نزل من ${first} لـ ${last}`; tone = 'good' }
    else if (Math.abs(delta) < 2) headline = en ? `Pain is steady around ${last}` : `الألم ثابت تقريباً عند ${last}`
    else { headline = en ? `Pain went up from ${first} to ${last} — your physio is on it` : `الألم زاد من ${first} لـ ${last} — دكتورك متابع معاك`; tone = 'amber' }
  } else {
    const delta = first != null && last != null ? last - first : null
    if (present.length === 0) headline = en ? "We'll start tracking your progress from your first session" : 'هنبدأ نتابع تقدمك من أول جلسة'
    else if (present.length === 1) headline = en ? `Starting point: ${last}%` : `نقطة البداية: ${last}%`
    else if (delta >= 10) { headline = en ? `Your level improved from ${first}% to ${last}%` : `مستواك اتحسن من ${first}% لـ ${last}%`; tone = 'good' }
    else if (Math.abs(delta) < 10) headline = en ? `Your level is steady at ${last}%` : `مستواك ثابت عند ${last}%`
    else { headline = en ? `A small dip — your physio is adjusting the plan` : `في تراجع بسيط — دكتورك بيعدّل الخطة معاك`; tone = 'amber' }
  }
  const toneColor = tone === 'good' ? C.green : tone === 'amber' ? C.amber : C.ink

  const greet = en ? `Hi ${d.firstName}` : `أهلاً يا ${d.firstName}`
  const last5 = (d.sessions || []).slice().reverse()

  return (
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
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.teal, textTransform: 'uppercase', marginBottom: 4 }}>{en ? 'Next session' : 'جلستك الجاية'}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>
            {fmtDate(next.date, lang)}{next.hasTime ? ` · ${en ? next.time : to12(next.time)}` : ''}
          </div>
          {next.physio && <div style={{ fontSize: 13, color: C.grey, marginTop: 2 }}>{en ? `with Dr. ${next.physio}` : `مع د. ${next.physio}`}</div>}
          {!next.hasTime && <div style={{ fontSize: 12, color: C.amber, marginTop: 4 }}>{en ? "we'll confirm the time with you" : 'هنأكد معاك الميعاد'}</div>}
        </Card>
      )}

      {/* progress */}
      <Card>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.teal, textTransform: 'uppercase', marginBottom: 6 }}>{en ? 'Your progress' : 'تقدمك'}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: toneColor, marginBottom: 10, lineHeight: 1.5 }}>{headline}</div>
        {track === 'function'
          ? <FunctionViz points={points} first={first} last={last} en={en} rtl={!en} />
          : points.length >= 1 && (
            <>
              <Chart points={points} yMax={10} rtl={!en} color={toneColor === C.ink ? C.teal : toneColor} caption={headline} />
              <div style={{ fontSize: 11, color: C.grey, textAlign: 'center', marginTop: 2 }}>{en ? 'lower = less pain · by session' : 'رقم أقل = ألم أقل · بالجلسة'}</div>
            </>
          )}
      </Card>

      {/* sessions done — full history, each session openable */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 4 }}>{en ? `Sessions done (${done})` : `الجلسات اللي ${fem ? 'خلصتيها' : 'خلصتها'} (${done})`}</div>
        <div style={{ fontSize: 12, color: C.grey, marginBottom: 8 }}>{en ? 'Tap any session to open its details.' : 'دوس على أي جلسة تفتح تفاصيلها.'}</div>
        {(showAll ? last5 : last5.slice(0, 6)).map((s, i) => {
          const metric = track === 'pain' ? (s.pain != null ? `${en ? 'pain' : 'ألم'} ${s.pain}/10` : null) : (s.progress != null ? `${s.progress}%` : null)
          const num = done - i   // newest first → session number counts down
          const hasNote = !!(s.note && String(s.note).trim())
          const isOpen = !!openSet[i]
          return (
            <div key={i} style={{ borderTop: i ? `1px solid ${C.line}` : 'none' }}>
              <button
                onClick={() => hasNote && setOpenSet((o) => ({ ...o, [i]: !o[i] }))}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 0', background: 'none', border: 'none', textAlign: en ? 'left' : 'right', cursor: hasNote ? 'pointer' : 'default', font: 'inherit' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.teal, background: '#EAF6F4', borderRadius: 8, padding: '2px 7px', whiteSpace: 'nowrap' }}>{en ? `#${num}` : `جلسة ${num}`}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' }}>{fmtDate(s.date, lang)}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                  {metric && <span style={{ fontSize: 11, fontWeight: 700, color: C.teal, background: '#EAF6F4', borderRadius: 999, padding: '2px 9px' }}>{metric}</span>}
                  {hasNote && <span style={{ fontSize: 10, color: C.grey, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>}
                </span>
              </button>
              {isOpen && hasNote && <div dir="auto" style={{ fontSize: 12.5, color: C.grey, margin: '0 0 10px', whiteSpace: 'pre-line', borderInlineStart: `3px solid ${C.soft}`, paddingInlineStart: 8 }}>{s.note}</div>}
            </div>
          )
        })}
        {done > 6 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{ width: '100%', marginTop: 10, padding: '9px 0', fontSize: 12.5, fontWeight: 700, color: C.teal, background: '#F4FBFC', border: `1px solid ${C.soft}`, borderRadius: 12, cursor: 'pointer' }}
          >
            {showAll ? (en ? 'Show less' : 'عرض أقل') : (en ? `Show all ${done} sessions` : `عرض كل الجلسات (${done})`)}
          </button>
        )}
      </Card>

      <div style={{ textAlign: 'center', fontSize: 11.5, color: C.grey, marginTop: 14, lineHeight: 1.7 }}>
        {en ? 'This page is private to you — please don’t share it.' : 'الصفحة دي خاصة بيك — متشاركهاش.'}
      </div>
    </Shell>
  )
}

function Shell({ children, dir }) {
  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#DCE2E4', display: 'flex', justifyContent: 'center', fontFamily: "'IBM Plex Sans Arabic','Tajawal',system-ui,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#F4F1EA', minHeight: '100vh', padding: '20px 16px 28px' }}>{children}</div>
    </div>
  )
}
function Card({ children, accent }) {
  return <div style={{ background: '#fff', border: `1px solid ${accent ? '#A9D9D1' : '#E3E7E5'}`, borderRadius: 18, padding: 16, marginTop: 14 }}>{children}</div>
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
