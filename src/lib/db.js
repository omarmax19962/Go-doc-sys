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
  userId: r.user_id || null,
})
export const toDoctor = (d) => ({
  name: d.name,
  spec: d.spec,
  zones: d.zones || [],
  slots: d.slots || [],
  files: d.files || [],
})

// ---- PATIENTS ----
export const fromPatient = (r) => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  complaint: r.complaint,
  history: r.history,
  files: r.files || [],
  zone: r.zone,
  locText: r.loc_text,
  locUrl: r.loc_url,
  dx: r.dx,
  status: r.status,
  doctor: r.doctor || '—',
  payment: r.payment || 'Pending',
  statusHistory: r.status_history || [],
  discharge: r.discharge || null,
})
export const toPatient = (p) => ({
  name: p.name,
  phone: p.phone,
  complaint: p.complaint,
  history: p.history,
  files: p.files || [],
  zone: p.zone,
  loc_text: p.locText,
  loc_url: p.locUrl,
  dx: p.dx,
  status: p.status,
  doctor: p.doctor || '—',
  payment: p.payment || 'Pending',
  status_history: p.statusHistory || [],
  discharge: p.discharge || null,
})

// ---- VISITS ----
export const fromVisit = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  doctorName: r.doctor_name,
  type: r.type,
  time: r.time,
  date: r.date,
  status: r.status,
})
export const toVisit = (v) => ({
  patient_id: v.patientId,
  doctor_name: v.doctorName,
  type: v.type,
  time: v.time,
  date: v.date,
  status: v.status,
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
  status: r.status,
  method: r.method,
})
export const toFinance = (f) => ({
  date: f.date,
  doctor: f.doctor,
  patient: f.patient,
  type: f.type,
  fee: f.fee,
  pct: f.pct,
  status: f.status,
  method: f.method,
})

// ---- CONFIG ----
export const fromConfig = (r) => ({
  defaultFee: Number(r.default_fee),
  defaultPct: Number(r.default_pct),
  currency: r.currency,
})
export const toConfig = (c) => ({
  default_fee: c.defaultFee,
  default_pct: c.defaultPct,
  currency: c.currency,
})

// ---- NOTIFICATIONS ----
export const fromNotif = (r) => ({
  id: r.id,
  ts: new Date(r.ts).getTime(),
  target: r.target,
  to: r.to,
  text: r.text,
  read: r.read,
})
