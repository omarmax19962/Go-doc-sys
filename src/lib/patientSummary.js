// patientSummary.js — turns a clinical SOAP note into plain, patient-friendly
// language in English or Arabic, with NO external service (free, instant).
// Used as the built-in default and as the fallback when the optional AI
// edge function isn't configured. The doctor can always edit the result.

const num = (v) => (v === 0 || v === '0' || (v != null && v !== '' && !isNaN(+v))) ? +v : null
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const list = (arr) => (arr || []).map((x) => (x && x.name) ? x.name : x).map(clean).filter(Boolean)

// One short, encouraging plain-language summary for a single session.
export function localSimplify(note, lang = 'en') {
  const ar = lang === 'ar'
  const parts = []
  const type = clean(note.type) || (ar ? 'جلسة' : 'session')
  const typeLabel = ar
    ? (/(assess|تقييم)/i.test(type) ? 'جلسة تقييم' : /(follow|متابعة)/i.test(type) ? 'جلسة متابعة' : 'جلسة علاج')
    : (/(assess)/i.test(type) ? 'Assessment session' : /(follow)/i.test(type) ? 'Follow-up session' : 'Treatment session')

  const pb = num(note.painBefore), pa = num(note.painAfter)
  if (pb != null && pa != null) {
    if (pa < pb) parts.push(ar
      ? `الألم قلّ من ${pb} إلى ${pa} من 10 خلال الجلسة — ده تحسّن كويس.`
      : `Your pain went down from ${pb} to ${pa} out of 10 during the session — a good improvement.`)
    else if (pa > pb) parts.push(ar
      ? `الألم زاد شوية من ${pb} إلى ${pa} من 10، وده ممكن يحصل وإحنا بنبني قوة العضلات.`
      : `Pain rose slightly from ${pb} to ${pa} out of 10, which can happen as we build strength.`)
    else parts.push(ar
      ? `الألم ثابت حوالي ${pa} من 10.`
      : `Your pain stayed steady at about ${pa} out of 10.`)
  } else if (pa != null) {
    parts.push(ar ? `مستوى الألم حاليًا حوالي ${pa} من 10.` : `Current pain level is about ${pa} out of 10.`)
  }

  const ex = list(note.exercises)
  if (ex.length) parts.push(ar
    ? `اشتغلنا على: ${ex.join('، ')}.`
    : `We worked on: ${ex.join(', ')}.`)

  const mod = list(note.modalities)
  if (mod.length) parts.push(ar
    ? `استخدمنا كمان: ${mod.join('، ')}.`
    : `We also used: ${mod.join(', ')}.`)

  const hep = clean(note.hep)
  if (hep) parts.push(ar ? `تمارين تعملها في البيت: ${hep}` : `To do at home: ${hep}`)

  const edu = clean(note.education)
  if (edu) parts.push(ar ? `نصيحة مهمة: ${edu}` : `Good to remember: ${edu}`)

  if (!parts.length) {
    const resp = clean(note.response) || clean(note.assessment)
    if (resp) parts.push(resp)
    else parts.push(ar
      ? `${typeLabel} تمّت. كمل على الخطة وهنشوف تطورك في الجلسة الجاية.`
      : `${typeLabel} completed. Keep going with the plan and we'll review your progress next time.`)
  }
  return parts.join(' ')
}

// Build the per-note patient text, preferring a saved/edited summary, else the
// stored AI summary for that language, else the local simplifier.
export function summaryFor(note, lang = 'en') {
  const saved = lang === 'ar' ? note.patientSummaryAr : note.patientSummaryEn
  if (clean(saved)) return clean(saved)
  return localSimplify(note, lang)
}

// Overall progress narrative across a series of (date-sorted) session notes.
export function progressOverview(notes, lang = 'en') {
  const ar = lang === 'ar'
  const withPain = notes.filter((n) => num(n.painBefore) != null || num(n.painAfter) != null)
  const first = withPain[0]
  const last = withPain[withPain.length - 1]
  const startPain = first ? (num(first.painBefore) ?? num(first.painAfter)) : null
  const endPain = last ? (num(last.painAfter) ?? num(last.painBefore)) : null
  const n = notes.length

  if (startPain != null && endPain != null && startPain > 0) {
    const dropPct = Math.max(0, Math.round(((startPain - endPain) / startPain) * 100))
    if (endPain < startPain) return ar
      ? `على مدى ${n} جلسة، الألم نزل من ${startPain} إلى ${endPain} من 10 — تحسّن حوالي ${dropPct}%. استمرارك على الخطة بيفرق فعلاً، وإحنا ماشيين في الاتجاه الصح.`
      : `Over ${n} session${n === 1 ? '' : 's'}, your pain has come down from ${startPain} to ${endPain} out of 10 — about ${dropPct}% better. Staying consistent is clearly paying off, and we're heading in the right direction.`
    if (endPain === startPain) return ar
      ? `على مدى ${n} جلسة، مستوى الألم ثابت حوالي ${endPain} من 10. بنشتغل على تثبيت المكسب وتقوية العضلات خطوة بخطوة.`
      : `Over ${n} session${n === 1 ? '' : 's'}, your pain has held steady at about ${endPain} out of 10. We're focused on locking in your gains and building strength step by step.`
    return ar
      ? `على مدى ${n} جلسة، فيه تغيّر في مستوى الألم وبنعدّل الخطة عشان نوصلك لأفضل نتيجة.`
      : `Over ${n} session${n === 1 ? '' : 's'}, your pain level has shifted, and we're adjusting the plan to get you the best result.`
  }
  return ar
    ? `أتممت ${n} جلسة مع فريق Go Doc. التقرير ده بيلخّص اللي اشتغلنا عليه وخطوتك الجاية.`
    : `You've completed ${n} session${n === 1 ? '' : 's'} with the Go Doc team. This report sums up what we've worked on and your next steps.`
}
