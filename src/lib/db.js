/**
 * db.js — row mappers between DB snake_case and the UI's camelCase shape.
 * The UI in App.jsx was built around the camelCase shape; rather than
 * rewrite all of it, we translate at the boundary.
 */

// ---- DOCTORS ----
export const fromDoctor = (r) => ({
  id: r.id,
  name: r.name,
  spec: r.spec,
  zones: r.zones || [],
  slots: r.slots || [],
  files: r.files || [],
  email: r.email || '',
  userId: r.user_id || null,
})
export const toDoctor = (d) => ({
  name: d.name,
  spec: d.spec,
  zones: d.zones || [],
  slots: d.slots || [],
  files: d.files || [],
  email: d.email ? d.email.trim() : null,
})

// ---- CONSULTANTS (referring ortho/neuro doctors) ----
export const fromConsultant = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email || '',
  phone: r.phone || '',
  specialty: r.specialty || '',
  clinic: r.clinic || '',
  userId: r.user_id || null,
})
export const toConsultant = (c) => ({
  name: c.name,
  email: c.email ? c.email.trim() : null,
  phone: c.phone ? c.phone.trim() : null,
  specialty: c.specialty || null,
  clinic: c.clinic || null,
})

// ---- PATIENTS ----
export const fromPatient = (r) => ({
  id: r.id,
  name: r.name,
  age: r.age ?? null,
  gender: r.gender ?? null,
  phone: r.phone,
  complaint: r.complaint,
  history: r.history,
  files: r.files || [],
  tags: r.tags || [],
  zone: r.zone,
  locText: r.loc_text,
  locUrl: r.loc_url,
  dx: r.dx,
  status: r.status,
  doctor: r.doctor || '—',
  payment: r.payment || 'Pending',
  statusHistory: r.status_history || [],
  discharge: r.discharge || null,
  source: r.source || '',
  referrerId: r.referrer_id ?? null,
  referrerConsent: !!r.referrer_consent,
  protocol: r.protocol || null,
  createdAt: r.created_at || null,
})
export const toPatient = (p) => ({
  name: p.name,
  age: p.age === '' || p.age == null ? null : Number(p.age),
  gender: p.gender || null,
  phone: p.phone,
  complaint: p.complaint,
  history: p.history,
  files: p.files || [],
  tags: Array.isArray(p.tags) ? p.tags : [],
  zone: p.zone,
  loc_text: p.locText,
  loc_url: p.locUrl,
  dx: p.dx,
  status: p.status,
  doctor: p.doctor || '—',
  payment: p.payment || 'Pending',
  status_history: p.statusHistory || [],
  discharge: p.discharge || null,
  source: p.source ? p.source.trim() : null,
  referrer_id: p.referrerId ?? null,
  referrer_consent: !!p.referrerConsent,
  protocol: p.protocol || null,
})

// ---- VISITS ----
export const fromVisit = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  doctorName: r.doctor_name,
  type: r.type,
  time: r.time,
  date: r.date,
  durationMin: r.duration_min ?? 45,
  status: r.status,
  cancelledBy: r.cancelled_by || null,
  rescheduledToId: r.rescheduled_to_id || null,
  rescheduledFromId: r.rescheduled_from_id || null,
  soapFiled: !!r.soap_filed,
  dueRemindedAt: r.due_reminded_at || null,
  packageId: r.package_id || null,
  packageSeq: r.package_seq ?? null,
  reminder24h: !!r.reminder_24h,
  reminder8h: !!r.reminder_8h,
  reminderSameday: !!r.reminder_sameday,
  rescheduleRequested: !!r.reschedule_requested,
  rescheduleNote: r.reschedule_note || null,
  reschedulePrefFrom: r.reschedule_pref_from || null,
  reschedulePrefTo: r.reschedule_pref_to || null,
  bookedBy: r.booked_by || 'patient',
  relativeName: r.relative_name || null,
  relativeRelation: r.relative_relation || null,
  createdBy: r.created_by || 'admin',
  approved: r.approved !== false,
})
export const toVisit = (v) => ({
  patient_id: v.patientId,
  doctor_name: v.doctorName,
  type: v.type,
  time: v.time,
  date: v.date,
  duration_min: v.durationMin ?? 45,
  status: v.status,
  cancelled_by: v.cancelledBy || null,
  rescheduled_to_id: v.rescheduledToId || null,
  rescheduled_from_id: v.rescheduledFromId || null,
  soap_filed: !!v.soapFiled,
  package_id: v.packageId || null,
  package_seq: v.packageSeq ?? null,
  booked_by: v.bookedBy || 'patient',
  relative_name: v.relativeName || null,
  relative_relation: v.relativeRelation || null,
  created_by: v.createdBy || 'admin',
  approved: v.approved !== false,
})

// ---- PACKAGES ----
export const fromPackage = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  patientName: r.patient_name,
  doctorName: r.doctor_name,
  title: r.title,
  totalSessions: r.total_sessions,
  price: Number(r.price || 0),
  paymentTerms: r.payment_terms,
  paymentStatus: r.payment_status || 'Pending',
  targetCompletion: r.target_completion,
  mode: r.mode || 'rolling',
  status: r.status || 'active',
  createdAt: r.created_at,
})
export const toPackage = (p) => ({
  patient_id: p.patientId,
  patient_name: p.patientName,
  doctor_name: p.doctorName,
  title: p.title,
  total_sessions: p.totalSessions,
  price: p.price ?? 0,
  payment_terms: p.paymentTerms || null,
  payment_status: p.paymentStatus || 'Pending',
  target_completion: p.targetCompletion || null,
  mode: p.mode || 'rolling',
  status: p.status || 'active',
})

// ---- NOTES ----
export const fromNote = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  patientName: r.patient_name,
  doctorName: r.doctor_name,
  visitId: r.visit_id,
  type: r.type,
  date: r.date,
  painBefore: r.pain_before,
  painAfter: r.pain_after,
  response: r.response,
  exercises: r.exercises || [],
  modalities: r.modalities || [],
  dx: r.dx,
  plan: r.plan,
  nextSessionDate: r.next_session_date,
  redFlag: r.red_flag,
  redFlagNote: r.red_flag_note,
  state: r.state,
  openedAt: r.opened_at,
  reviewedAt: r.reviewed_at,
  createdAt: r.created_at || null,
  // structured SOAP narrative fields
  subjective: r.subjective || '',
  objective: r.objective || '',
  measures: r.measures || '',
  assessment: r.assessment || '',
  goals: r.goals || '',
  hep: r.hep || '',
  education: r.education || '',
  additionalNotes: r.additional_notes || '',
  // patient-facing simplified summaries
  patientSummaryEn: r.patient_summary_en || '',
  patientSummaryAr: r.patient_summary_ar || '',
  patientSummaryEdited: !!r.patient_summary_edited,
  functionalScores: r.functional_scores || null,
})
export const toNote = (n) => ({
  patient_id: n.patientId,
  patient_name: n.patientName,
  doctor_name: n.doctorName,
  visit_id: n.visitId,
  type: n.type,
  date: n.date,
  pain_before: n.painBefore,
  pain_after: n.painAfter,
  response: n.response,
  exercises: n.exercises || [],
  modalities: n.modalities || [],
  dx: n.dx,
  plan: n.plan,
  next_session_date: n.nextSessionDate,
  red_flag: !!n.redFlag,
  red_flag_note: n.redFlagNote,
  state: n.state || 'submitted',
  subjective: n.subjective ? n.subjective.trim() : null,
  objective: n.objective ? n.objective.trim() : null,
  measures: n.measures ? n.measures.trim() : null,
  assessment: n.assessment ? n.assessment.trim() : null,
  goals: n.goals ? n.goals.trim() : null,
  hep: n.hep ? n.hep.trim() : null,
  education: n.education ? n.education.trim() : null,
  additional_notes: n.additionalNotes ? n.additionalNotes.trim() : null,
  patient_summary_en: n.patientSummaryEn ? n.patientSummaryEn.trim() : null,
  patient_summary_ar: n.patientSummaryAr ? n.patientSummaryAr.trim() : null,
  patient_summary_edited: !!n.patientSummaryEdited,
  functional_scores: (n.functionalScores && Object.keys(n.functionalScores).length) ? n.functionalScores : null,
})

// ---- EXERCISES ----
export const fromExercise = (r) => ({
  id: r.id,
  name: r.name,
  dosageHint: r.dosage_hint,
  position: r.position,
  description: r.description,
  notes: r.notes,
  mediaUrl: r.media_url,
})
export const toExercise = (e) => ({
  name: e.name,
  dosage_hint: e.dosageHint,
  position: e.position,
  description: e.description,
  notes: e.notes,
  media_url: e.mediaUrl,
})

// ---- MODALITIES ----
export const fromModality = (r) => ({ id: r.id, name: r.name, params: r.params })
export const toModality = (m) => ({ name: m.name, params: m.params })

// ---- FINANCES ----
export const fromFinance = (r) => ({
  id: r.id,
  date: r.date,
  doctor: r.doctor,
  patient: r.patient,
  type: r.type,
  fee: Number(r.fee),
  pct: Number(r.pct),
  discount: Number(r.discount || 0),
  status: r.status,
  method: r.method,
  paidOut: !!r.paid_out,
  paidOutDate: r.paid_out_date || null,
  visitId: r.visit_id || null,
})
export const toFinance = (f) => ({
  date: f.date,
  doctor: f.doctor,
  patient: f.patient,
  type: f.type,
  fee: f.fee,
  pct: f.pct,
  discount: f.discount == null || f.discount === '' ? 0 : Number(f.discount),
  status: f.status,
  method: f.method,
  paid_out: !!f.paidOut,
  paid_out_date: f.paidOutDate || null,
  visit_id: f.visitId || null,
})

// ---- CREDITS (patient prepaid wallet — top-ups) ----
export const fromCredit = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  patientName: r.patient_name || '',
  amount: Number(r.amount || 0),
  date: r.date || null,
  note: r.note || '',
  createdAt: r.created_at || null,
})
export const toCredit = (c) => ({
  patient_id: c.patientId,
  patient_name: c.patientName || null,
  amount: c.amount == null || c.amount === '' ? 0 : Number(c.amount),
  date: c.date || null,
  note: c.note ? c.note.trim() : null,
})

// ---- EXPENSES ----
export const fromExpense = (r) => ({
  id: r.id,
  month: r.month,
  category: r.category || 'Marketing',
  label: r.label || '',
  amount: Number(r.amount || 0),
  note: r.note || '',
  createdAt: r.created_at || null,
})
export const toExpense = (e) => ({
  month: e.month,
  category: e.category || 'Marketing',
  label: e.label ? e.label.trim() : null,
  amount: e.amount == null || e.amount === '' ? 0 : Number(e.amount),
  note: e.note ? e.note.trim() : null,
})

// ---- GROWTH MONTHS (manual ledger) ----
export const fromGrowth = (r) => ({
  id: r.id,
  month: r.month,
  newPatients: r.new_patients ?? 0,
  moneyIn: Number(r.money_in || 0),
  moneyOut: Number(r.money_out || 0),
  marketing: Number(r.marketing || 0),
  note: r.note || '',
  createdAt: r.created_at || null,
})
export const toGrowth = (g) => ({
  month: g.month,
  new_patients: g.newPatients == null || g.newPatients === '' ? 0 : Number(g.newPatients),
  money_in: g.moneyIn == null || g.moneyIn === '' ? 0 : Number(g.moneyIn),
  money_out: g.moneyOut == null || g.moneyOut === '' ? 0 : Number(g.moneyOut),
  marketing: g.marketing == null || g.marketing === '' ? 0 : Number(g.marketing),
  note: g.note ? g.note.trim() : null,
})

// ---- CONFIG ----
export const fromConfig = (r) => ({
  defaultFee: Number(r.default_fee),
  defaultPct: Number(r.default_pct),
  currency: r.currency,
  noShowConsumesSlot: r.no_show_consumes_slot ?? true,
  packageCreationTiming: r.package_creation_timing || 'post_assessment',
  tmpl24h: r.tmpl_24h || '',
  tmpl8h: r.tmpl_8h || '',
  tmplSameday: r.tmpl_sameday || '',
  tmplDoctor: r.tmpl_doctor || '',
})
export const toConfig = (c) => ({
  default_fee: c.defaultFee,
  default_pct: c.defaultPct,
  currency: c.currency,
  no_show_consumes_slot: c.noShowConsumesSlot ?? true,
  package_creation_timing: c.packageCreationTiming || 'post_assessment',
  tmpl_24h: c.tmpl24h ?? '',
  tmpl_8h: c.tmpl8h ?? '',
  tmpl_sameday: c.tmplSameday ?? '',
  tmpl_doctor: c.tmplDoctor ?? '',
})

// ---- TASKS (shared idea / task board) ----
export const fromTask = (r) => ({
  id: r.id,
  kind: r.kind || 'task',
  title: r.title || '',
  detail: r.detail || '',
  assignee: r.assignee || 'both',
  status: r.status || 'todo',
  priority: r.priority || 'normal',
  dueDate: r.due_date || null,
  createdBy: r.created_by || null,
  doneAt: r.done_at || null,
  createdAt: r.created_at || null,
  updatedAt: r.updated_at || null,
})
export const toTask = (t) => ({
  kind: t.kind || 'task',
  title: t.title ? t.title.trim() : '',
  detail: t.detail ? t.detail.trim() : null,
  assignee: t.assignee || 'both',
  status: t.status || 'todo',
  priority: t.priority || 'normal',
  due_date: t.dueDate || null,
  created_by: t.createdBy || null,
  done_at: t.doneAt || null,
})

// ---- NOTIFICATIONS ----
export const fromNotif = (r) => ({
  id: r.id,
  ts: new Date(r.ts).getTime(),
  target: r.target,
  to: r.to,
  text: r.text,
  read: r.read,
  link: r.link || null,
})
