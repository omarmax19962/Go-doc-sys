// consultantMsg.js — builds the WhatsApp messages we send to a patient's
// referring consultant (ortho/neuro). Plain text, clinician-to-clinician tone.
// Paired with openWhatsApp() (wa.me click-to-send) — no Business API needed.

const num = (v) => (v === 0 || v === '0' || (v != null && v !== '' && !isNaN(+v))) ? +v : null
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const firstName = (s) => clean(s).split(' ')[0] || ''

// Pain trend across date-sorted notes → { start, end, dropPct } or null.
const painTrend = (notes = []) => {
  const withPain = notes.filter((n) => num(n.painBefore) != null || num(n.painAfter) != null)
  if (!withPain.length) return null
  const first = withPain[0], last = withPain[withPain.length - 1]
  const start = num(first.painBefore) ?? num(first.painAfter)
  const end = num(last.painAfter) ?? num(last.painBefore)
  if (start == null || end == null) return null
  const dropPct = start > 0 ? Math.max(0, Math.round(((start - end) / start) * 100)) : 0
  return { start, end, dropPct }
}

const sortNotes = (notes = []) => notes.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))

// 1) New referral confirmed — sent when a patient is linked to the consultant.
export function referralConfirmation({ patient, consultant, clinic = 'Go Doc' }) {
  const dr = consultant?.name ? `Dr. ${firstName(consultant.name)}` : 'Doctor'
  const dx = patient?.dx?.label ? ` for ${patient.dx.label}` : ''
  const doc = patient?.doctor && patient.doctor !== '—' ? `\nTreating physiotherapist: ${patient.doctor}.` : ''
  return `Hello ${dr},\n\nYour patient *${clean(patient?.name)}* has started physiotherapy with ${clinic}${dx}.\n\nYou're set as the supervising consultant — you'll receive progress updates and we'll follow any precautions you set.${doc}\n\nYou can set the rehab protocol and follow every session in your ${clinic} portal.`
}

// 2) Weekly progress digest — concise, clinical.
export function weeklyDigest({ patient, notes = [], clinic = 'Go Doc' }) {
  const dr = patient ? '' : ''
  const sorted = sortNotes(notes)
  const n = sorted.length
  const last = sorted[n - 1]
  const t = painTrend(sorted)
  const phase = patient?.protocol?.phase ? `\nCurrent phase: ${clean(patient.protocol.phase)}` : ''
  const trendLine = t
    ? `Pain ${t.start} → ${t.end}/10 (${t.dropPct}% improvement).`
    : 'Pain not yet charted.'
  const lastLine = last
    ? `\nLast session: ${last.date || '—'}${last.type ? ` (${last.type})` : ''}${last.response ? ` — ${clean(last.response)}` : ''}.`
    : ''
  const onTrack = t ? (t.end < t.start ? 'On track ✅' : t.end === t.start ? 'Holding steady' : 'Needs review ⚠️') : ''
  return `*${clean(patient?.name)} — progress update*\n\nSessions completed: ${n}.\n${trendLine}${phase}${lastLine}\n${onTrack ? `\nStatus: ${onTrack}` : ''}\n\n— ${clinic}. Full timeline in your portal.`
}

// 3) Red-flag escalation — sent immediately when a physio raises a red flag.
export function redFlagAlert({ patient, note, clinic = 'Go Doc' }) {
  const reason = clean(note?.redFlagNote) || 'a clinical red flag'
  const who = note?.doctorName ? ` by ${note.doctorName}` : ''
  return `⚠️ *Red flag — ${clean(patient?.name)}*\n\nA red flag was raised${who} during today's session: ${reason}.\n\nThe session has been documented and ${clinic} is following up. Please advise if you'd like to review the patient.`
}

// 4) Discharge summary — closes the referral loop.
export function dischargeSummary({ patient, clinic = 'Go Doc' }) {
  const d = patient?.discharge || {}
  const sessions = d.sessions != null ? `${d.sessions} sessions` : 'their rehab program'
  const imp = d.improvePct != null ? `, with ~${d.improvePct}% improvement` : ''
  const pain = (d.startPain != null && d.endPain != null) ? ` (pain ${d.startPain} → ${d.endPain}/10)` : ''
  const dr = patient?.dx?.label ? ` following ${patient.dx.label}` : ''
  return `*Discharge summary — ${clean(patient?.name)}*\n\nYour patient has completed ${sessions}${imp}${pain}${dr}.\n\n${clean(d.summary) || 'Thank you for entrusting their rehabilitation to us.'}\n\n— ${clinic}. Full report available in your portal.`
}

// Convenience: which message + builder for a given key.
export const CONSULTANT_MESSAGES = [
  { key: 'referral', label: 'Referral confirmation', build: referralConfirmation },
  { key: 'digest', label: 'Weekly progress digest', build: weeklyDigest },
  { key: 'redflag', label: 'Red-flag alert', build: redFlagAlert },
  { key: 'discharge', label: 'Discharge summary', build: dischargeSummary },
]
