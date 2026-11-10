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
    return { present, first: present.length ? present[0].v : null, last: present.length ? present[present.length - 1].v : null, points: present.map((x, k) => ({ n: k + 1, v: x.v })) }
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
        <div style={{ fontSize: 17, fontWeight: 800, color: toneColor, marginBottom: 10, lineHeight: 1.5 }}>{headline}</div>
        {metric === 'function'
          ? <FunctionViz points={points} first={first} last={last} en={en} rtl={!en} />
          : (points.length >= 1
            ? <>
                <Chart points={points} yMax={10} rtl={!en} color={toneColor === C.ink ? C.teal : toneColor} caption={headline} />
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
      </Shell>

      {allView && (
        <AllSessions sessions={last5} done={done} metric={metric} lang={lang} en={en} fem={fem}
          onOpen={(ss, n) => setSheet({ s: ss, num: n })} onClose={() => setAllView(false)} />
      )}
      {sheet && <SessionSheet s={sheet.s} num={sheet.num} lang={lang} en={en} onClose={() => setSheet(null)} />}
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
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 40px' }}>
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
    <div style={{ flex: '1 1 90px', background: '#fff', border: '1px solid #E3E7E5', borderRadius: 14, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: C.grey, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{value}</div>
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
      <div onClick={stop} dir={en ? 'ltr' : 'rtl'} style={{ width: '100%', maxWidth: 480, background: '#F4F1EA', borderRadius: '22px 22px 0 0', padding: '10px 18px 24px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 -8px 30px rgba(0,0,0,.18)', fontFamily: "'IBM Plex Sans Arabic','Tajawal',system-ui,sans-serif" }}>
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
                  {ex.map((e, k) => <span key={k} style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, background: '#fff', border: '1px solid #E3E7E5', borderRadius: 10, padding: '5px 10px' }}>{typeof e === 'string' ? e : (e.name || '')}</span>)}
                </div>
              </div>
            )}
            {mod.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: C.grey, marginBottom: 4 }}>{en ? 'Modalities' : 'أجهزة ووسائل علاجية'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {mod.map((e, k) => <span key={k} style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, background: '#fff', border: '1px solid #E3E7E5', borderRadius: 10, padding: '5px 10px' }}>{typeof e === 'string' ? e : (e.name || '')}</span>)}
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
