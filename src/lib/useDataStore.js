import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import {
  fromDoctor, toDoctor,
  fromPatient, toPatient,
  fromVisit, toVisit,
  fromNote, toNote,
  fromExercise, toExercise,
  fromModality, toModality,
  fromFinance, toFinance,
  fromExpense, toExpense,
  fromGrowth, toGrowth,
  fromConfig, toConfig,
  fromPackage, toPackage,
  fromTask, toTask,
  fromNotif,
} from './db'
import { openWhatsApp } from './wa'
import { showLocalNotification } from './push'

// Human label for a task's assignee — used in device notifications.
const assigneeTail = (a) => a === 'omar' ? ' · for Omar' : a === 'michael' ? ' · for Michael' : ''

/**
 * useDataStore — single source of truth for the app. Loads all entities once,
 * exposes them in the camelCase shape App.jsx expects, and provides mutation
 * functions that write to Supabase and update local state optimistically.
 *
 * Optimistic updates keep the UI snappy; if a write fails we re-fetch that table.
 */
export function useDataStore({ role, me }) {
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [visits, setVisits] = useState([])
  const [notes, setNotes] = useState([])
  const [exerciseLib, setExerciseLib] = useState([])
  const [modalityLib, setModalityLib] = useState([])
  const [finances, setFinances] = useState([])
  const [expenses, setExpenses] = useState([])
  const [growthMonths, setGrowthMonths] = useState([])
  const [packages, setPackages] = useState([])
  const [config, setConfigState] = useState({ defaultFee: 500, defaultPct: 0.6, currency: 'EGP', noShowConsumesSlot: true, packageCreationTiming: 'post_assessment' })
  const [notifs, setNotifs] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const meRef = useRef(me)
  useEffect(() => { meRef.current = me }, [me])
  // Ids this client just wrote, so realtime doesn't buzz us for our own changes.
  const localTaskWrites = useRef(new Map())

  // ---- INITIAL LOAD ----
  // When a doctor signs in we only pull *their* rows (patients/visits/notes/
  // finances/packages/notifications scoped by name) instead of the whole
  // clinic dataset — a profile loads fast and stays small. Admin loads all.
  const isDoctor = role === 'doctor'
  const loadAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Per-doctor scoping helper: filter `table` by `col === me` for doctors.
      const scoped = (table, col, order = 'id') => {
        let q = supabase.from(table).select('*')
        if (isDoctor && col && me) q = q.eq(col, me)
        return q.order(order)
      }
      const notifQ = isDoctor
        ? supabase.from('notifications').select('*').eq('target', 'doctor').eq('to', me).order('ts', { ascending: false }).limit(50)
        : supabase.from('notifications').select('*').order('ts', { ascending: false }).limit(50)
      const [d, p, v, n, ex, m, f, c, notes_n, pk, exp, gm, tk] = await Promise.all([
        supabase.from('doctors').select('*').order('id'), // small table, needed for name/colour lookups
        scoped('patients', 'doctor'),
        scoped('visits', 'doctor_name'),
        scoped('notes', 'doctor_name'),
        supabase.from('exercises').select('*').order('id'),
        supabase.from('modalities').select('*').order('id'),
        scoped('finances', 'doctor'),
        supabase.from('config').select('*').eq('id', 1).maybeSingle(),
        notifQ,
        scoped('packages', 'doctor_name'),
        // expenses + growth are admin-only finance ledgers — skip for doctors
        isDoctor ? Promise.resolve({ data: [] }) : supabase.from('expenses').select('*').order('id'),
        isDoctor ? Promise.resolve({ data: [] }) : supabase.from('growth_months').select('*').order('month'),
        // shared task / idea board — admin-only
        isDoctor ? Promise.resolve({ data: [] }) : supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      ])
      if (d.error) throw d.error
      setDoctors((d.data || []).map(fromDoctor))
      setPatients((p.data || []).map(fromPatient))
      setVisits((v.data || []).map(fromVisit))
      setNotes((n.data || []).map(fromNote))
      setExerciseLib((ex.data || []).map(fromExercise))
      setModalityLib((m.data || []).map(fromModality))
      setFinances((f.data || []).map(fromFinance))
      if (c.data) setConfigState(fromConfig(c.data))
      setNotifs((notes_n.data || []).map(fromNotif))
      setPackages((pk.data || []).map(fromPackage))
      setExpenses((exp.data || []).map(fromExpense))
      setGrowthMonths((gm.data || []).map(fromGrowth))
      setTasks((tk.data || []).map(fromTask))
    } catch (e) {
      console.error('[useDataStore] load failed', e)
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [isDoctor, me])

  useEffect(() => { loadAll() }, [loadAll])

  // ---- REALTIME SUBSCRIPTIONS ----
  // Refetches reuse the same per-doctor scoping as the initial load so a
  // doctor's local cache never balloons to the whole clinic on a live change.
  useEffect(() => {
    const reNotes = () => { let q = supabase.from('notes').select('*'); if (isDoctor && me) q = q.eq('doctor_name', me); q.order('id').then(({ data }) => setNotes((data || []).map(fromNote))) }
    const reVisits = () => { let q = supabase.from('visits').select('*'); if (isDoctor && me) q = q.eq('doctor_name', me); q.order('id').then(({ data }) => setVisits((data || []).map(fromVisit))) }
    const rePackages = () => { let q = supabase.from('packages').select('*'); if (isDoctor && me) q = q.eq('doctor_name', me); q.order('id').then(({ data }) => setPackages((data || []).map(fromPackage))) }
    const ch = supabase
      .channel('godoc-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, reNotes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (p) => {
        if (!p.new) return
        // doctors only care about their own doctor-targeted notifications
        if (isDoctor && !(p.new.target === 'doctor' && p.new.to === me)) return
        setNotifs((ns) => [fromNotif(p.new), ...ns.filter((x) => x.id !== p.new.id)])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, reVisits)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, rePackages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        if (isDoctor) return
        supabase.from('expenses').select('*').order('id').then(({ data }) => setExpenses((data || []).map(fromExpense)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'growth_months' }, () => {
        if (isDoctor) return
        supabase.from('growth_months').select('*').order('month').then(({ data }) => setGrowthMonths((data || []).map(fromGrowth)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (p) => {
        if (isDoctor) return // doctors don't have the board
        if (p.eventType === 'DELETE') { setTasks((ts) => ts.filter((t) => t.id !== (p.old && p.old.id))); return }
        const row = fromTask(p.new)
        setTasks((ts) => ts.some((t) => t.id === row.id) ? ts.map((t) => t.id === row.id ? row : t) : [row, ...ts])
        // Skip a device buzz for a change this very client just made.
        const mine = localTaskWrites.current.get(row.id)
        if (mine && Date.now() - mine < 6000) return
        if (p.eventType === 'INSERT') {
          showLocalNotification(row.kind === 'idea' ? '💡 New idea' : '✅ New task', `${row.title}${assigneeTail(row.assignee)}`, { tag: `task-${row.id}` })
        } else if (p.eventType === 'UPDATE' && row.status === 'done' && p.old && p.old.status !== 'done') {
          showLocalNotification('Task completed', row.title, { tag: `task-${row.id}` })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [isDoctor, me])

  // ---- HELPERS ----
  const nowISO = () => new Date().toISOString()

  // `link` is an optional { view?, patientId?, visitId? } payload telling the
  // UI where to jump when the notification is tapped (see NotifBell / navigate).
  const notify = useCallback(async (target, text, to, link = null) => {
    const tmpId = Date.now() + Math.random()
    setNotifs((ns) => [{ id: tmpId, ts: Date.now(), target, to, text, read: false, link }, ...ns])
    const { data, error } = await supabase
      .from('notifications')
      .insert({ target, to: to || null, text, link })
      .select()
      .single()
    if (error) console.warn('notify failed', error)
    else setNotifs((ns) => ns.map((n) => (n.id === tmpId ? fromNotif(data) : n)))
  }, [])

  const markRead = useCallback(async (target, to) => {
    setNotifs((ns) => ns.map((n) =>
      (n.target === target && (target === 'admin' || !n.to || n.to === to)) ? { ...n, read: true } : n
    ))
    let q = supabase.from('notifications').update({ read: true }).eq('target', target).eq('read', false)
    if (target === 'doctor' && to) q = q.eq('to', to)
    await q
  }, [])

  // ---- DUE-SESSION REMINDERS ----
  // When a scheduled session's date + time arrives, nudge the assigned doctor to
  // document it: logging the visit is what records the clinical case and releases
  // the doctor's payment. Fires an in-app notification + a device notification
  // (PWA) once per visit. `due_reminded_at` persists the fired state so it never
  // repeats across reloads or devices. Runs only in the doctor's own app instance.
  const remindedRef = useRef(new Set())
  useEffect(() => {
    if (role !== 'doctor') return
    const check = () => {
      const now = Date.now()
      const due = visits.filter((v) => {
        if (v.doctorName !== meRef.current || v.soapFiled || v.dueRemindedAt) return false
        if (remindedRef.current.has(v.id)) return false
        if (!['scheduled', 'confirmed', 'pending_confirmation'].includes(v.status)) return false
        if (!v.date || !v.time) return false
        const hm = /^(\d{1,2}):(\d{2})/.exec(v.time)
        if (!hm) return false
        const dueAt = new Date(`${v.date}T${hm[1].padStart(2, '0')}:${hm[2]}:00`).getTime()
        return !Number.isNaN(dueAt) && dueAt <= now
      })
      due.forEach(async (v) => {
        remindedRef.current.add(v.id)
        const p = patients.find((x) => x.id === v.patientId)
        const pname = p?.name || 'your patient'
        const kind = (v.type || 'session').toLowerCase()
        const stamp = nowISO()
        await supabase.from('visits').update({ due_reminded_at: stamp }).eq('id', v.id)
        setVisits((vs) => vs.map((x) => x.id === v.id ? { ...x, dueRemindedAt: stamp } : x))
        notify('doctor', `⏰ Time to document ${pname}'s ${kind} — log the session now to record your case and receive your payment.`, meRef.current, { patientId: v.patientId })
        showLocalNotification('Session ready to log', `${pname} · ${v.type} at ${v.time}. Tap to document it and get paid.`, { tag: `due-${v.id}`, url: '/' })
      })
    }
    check()
    const iv = setInterval(check, 60000)
    return () => clearInterval(iv)
  }, [visits, patients, role, notify])

  // ---- PATIENT MUTATIONS ----
  const _writePatient = async (id, patch) => {
    const { error } = await supabase.from('patients').update(toPatient(patch)).eq('id', id)
    if (error) console.error('writePatient', error)
  }

  // Create a single Pending finance line for a freshly-booked visit, linked by
  // visit_id so a later completion / SOAP note never double-bills the same
  // session. Idempotent locally via the visit_id guard.
  const _billVisit = useCallback(async (visit, patientName) => {
    if (!visit || !visit.id) return
    const fin = {
      date: visit.date || new Date().toISOString().slice(0, 10),
      doctor: visit.doctorName || '—', patient: patientName || '—',
      type: visit.type || 'Treatment', fee: config.defaultFee, pct: config.defaultPct,
      status: 'Pending', method: 'Cash', visit_id: visit.id,
    }
    const { data, error } = await supabase.from('finances').insert(fin).select().single()
    if (error) { console.warn('billVisit', error); return }
    setFinances((fs) => fs.some((f) => f.visitId === visit.id) ? fs : [...fs, fromFinance(data)])
  }, [config])

  const changeStatus = useCallback((pid, to, note, actor) => {
    actor = actor || (role === 'admin' ? 'Admin' : meRef.current)
    setPatients((ps) => ps.map((p) => {
      if (p.id !== pid || p.status === to) return p
      const entry = { from: p.status, to, by: actor, note: note || null, at: nowISO() }
      const next = { ...p, status: to, statusHistory: [...(p.statusHistory || []), entry] }
      _writePatient(pid, next)
      return next
    }))
  }, [role])

  const updatePatientStatus = useCallback((pid, to, note) => {
    const pt = patients.find((p) => p.id === pid)
    changeStatus(pid, to, note)
    if (pt) notify('admin', `${pt.name} marked ${to}${note ? ` — ${note}` : ''}`, null, { patientId: pid })
  }, [patients, changeStatus, notify])

  const addPatient = useCallback(async (p, booked, date, doctor, time) => {
    const newRow = {
      ...p,
      status: booked ? 'booked' : 'lead',
      doctor: booked ? doctor : '—',
      payment: 'Pending',
      statusHistory: [{ from: null, to: booked ? 'booked' : 'lead', by: 'Admin', note: booked ? `Booked with ${doctor}` : 'Intake — lead', at: nowISO() }],
    }
    const { data, error } = await supabase.from('patients').insert(toPatient(newRow)).select().single()
    if (error) { console.error('addPatient', error); return }
    const inserted = fromPatient(data)
    setPatients((ps) => [...ps, inserted])
    if (booked) {
      const v = { patient_id: inserted.id, doctor_name: doctor, type: 'Assessment', time: time || '09:00', date, status: 'scheduled' }
      const { data: vd } = await supabase.from('visits').insert(v).select().single()
      if (vd) {
        const iv = fromVisit(vd)
        setVisits((vs) => [...vs, iv])
        await _billVisit(iv, inserted.name)
      }
    }
    notify('admin', booked ? `New booking: ${p.name} → ${doctor} (${date}${time ? ` ${time}` : ''})` : `New lead added: ${p.name}`, null, { patientId: inserted.id })
    if (booked) notify('doctor', `New patient booked with you: ${p.name} (${date}${time ? ` ${time}` : ''})`, doctor, { patientId: inserted.id })
  }, [config, notify, _billVisit])

  const updatePatientFiles = useCallback(async (pid, files) => {
    setPatients((ps) => ps.map((p) => p.id === pid ? { ...p, files } : p))
    await supabase.from('patients').update({ files }).eq('id', pid)
  }, [])

  // Edit a patient's profile fields (name, age, gender, phone, complaint,
  // history, zone, location, source, dx). Merges the patch over the current
  // record so partial updates are safe.
  const updatePatient = useCallback(async (pid, patch) => {
    const prev = patients.find((p) => p.id === pid)
    let next = null
    setPatients((ps) => ps.map((p) => {
      if (p.id !== pid) return p
      next = { ...p, ...patch }
      return next
    }))
    if (!next) return
    const { error } = await supabase.from('patients').update(toPatient(next)).eq('id', pid)
    if (error) { console.error('updatePatient', error); return }
    // finances are keyed by patient name — re-point them on rename so the
    // patient's billing history stays attached and reports don't split.
    if (prev && patch.name && patch.name !== prev.name) {
      setFinances((fs) => fs.map((f) => f.patient === prev.name ? { ...f, patient: patch.name } : f))
      await supabase.from('finances').update({ patient: patch.name }).eq('patient', prev.name)
    }
    notify('admin', `Patient profile updated: ${next.name}`, null, { patientId: pid })
  }, [patients, notify])

  const assignDoctor = useCallback(async (pid, name) => {
    const pt = patients.find((p) => p.id === pid)
    setPatients((ps) => ps.map((p) => p.id === pid ? { ...p, doctor: name } : p))
    await supabase.from('patients').update({ doctor: name }).eq('id', pid)
    if (pt && pt.status === 'lead' && name) changeStatus(pid, 'booked', `Assigned ${name}`)
    const up = visits.find((v) => v.patientId === pid && v.status !== 'completed')
    if (up) {
      setVisits((vs) => vs.map((v) => v.id === up.id ? { ...v, doctorName: name } : v))
      await supabase.from('visits').update({ doctor_name: name }).eq('id', up.id)
    } else if (name) {
      const hasHistory = visits.some((v) => v.patientId === pid && v.status === 'completed')
      const newV = { patient_id: pid, doctor_name: name, type: hasHistory ? 'Treatment' : 'Assessment', time: 'to schedule', status: 'scheduled' }
      const { data } = await supabase.from('visits').insert(newV).select().single()
      if (data) {
        const iv = fromVisit(data)
        setVisits((vs) => [...vs, iv])
        await _billVisit(iv, pt?.name)
      }
    }
    if (name) notify('doctor', `You were assigned to ${pt?.name || 'a patient'} — visit added to your list`, name, { patientId: pid })
  }, [patients, visits, changeStatus, notify, _billVisit])

  // Calendly-style booking: drops a scheduled visit at a specific date/time.
  // If `newPatient` is supplied (no patientId), creates the patient first.
  const bookSession = useCallback(async ({ patientId, newPatient, doctorName, date, time, durationMin = 45, type = 'Treatment', booker = 'admin', bookedBy = 'patient', relativeName = null, relativeRelation = null, count = 1 }) => {
    let pid = patientId
    let pname
    if (!pid && newPatient && newPatient.name) {
      const row = {
        ...newPatient,
        status: 'booked',
        doctor: doctorName || '—',
        payment: 'Pending',
        statusHistory: [{ from: null, to: 'booked', by: booker === 'doctor' ? doctorName : 'Admin', note: 'Booked via calendar', at: nowISO() }],
      }
      const { data, error } = await supabase.from('patients').insert(toPatient(row)).select().single()
      if (error) { console.error('bookSession patient', error); return }
      const inserted = fromPatient(data)
      setPatients((ps) => [...ps, inserted])
      pid = inserted.id; pname = inserted.name
    } else {
      pname = patients.find((p) => p.id === pid)?.name || '—'
    }
    if (!pid) return
    const n = Math.max(1, Math.min(60, Number(count) || 1))
    const base = { patient_id: pid, doctor_name: doctorName, type, time: time || '—', date: date || null, duration_min: durationMin, status: 'scheduled', booked_by: bookedBy || 'patient', relative_name: bookedBy === 'relative' ? (relativeName || null) : null, relative_relation: bookedBy === 'relative' ? (relativeRelation || null) : null }
    // Only the first session keeps a precise date when bulk-creating; the rest are left undated to schedule later.
    const rows = Array.from({ length: n }, (_, i) => (i === 0 ? base : { ...base, date: null, time: '—' }))
    const { data: vd, error: verr } = await supabase.from('visits').insert(rows).select()
    if (verr) { console.error('bookSession visit', verr); return }
    const insertedVisits = (vd || []).map(fromVisit)
    setVisits((vs) => [...vs, ...insertedVisits])
    // Each booked session immediately shows in the books as a Pending line,
    // linked by visit_id so completion / SOAP won't double-bill it.
    if (insertedVisits.length) {
      const today = new Date().toISOString().slice(0, 10)
      const finRows = insertedVisits.map((v) => ({
        date: v.date || today, doctor: doctorName || '—', patient: pname,
        type: v.type, fee: config.defaultFee, pct: config.defaultPct,
        status: 'Pending', method: 'Cash', visit_id: v.id,
      }))
      const { data: fdata, error: ferr } = await supabase.from('finances').insert(finRows).select()
      if (ferr) console.warn('bookSession finance', ferr)
      else if (fdata) setFinances((fs) => [...fs, ...fdata.map(fromFinance)])
    }
    if (n > 1) {
      notify('admin', `${n} sessions booked: ${pname} → ${doctorName || '—'}${date ? ` (1st on ${date})` : ' (dates open)'}`, null, { patientId: pid })
      if (doctorName && booker !== 'doctor') notify('doctor', `${n} sessions booked: ${pname}`, doctorName, { patientId: pid })
    } else {
      notify('admin', `Session booked: ${pname} → ${doctorName || '—'} (${date || '—'} ${time || ''})`, null, { patientId: pid })
      if (doctorName && booker !== 'doctor') notify('doctor', `New session booked: ${pname} (${date || '—'} ${time || ''})`, doctorName, { patientId: pid })
    }
  }, [patients, config, notify])

  // Move/resize a visit on the calendar (drag or edit).
  const rescheduleVisit = useCallback(async (vid, { date, time, durationMin }) => {
    const patch = {}
    if (date !== undefined) patch.date = date
    if (time !== undefined) patch.time = time
    if (durationMin !== undefined) patch.duration_min = durationMin
    setVisits((vs) => vs.map((v) => v.id === vid ? { ...v, ...(date !== undefined ? { date } : {}), ...(time !== undefined ? { time } : {}), ...(durationMin !== undefined ? { durationMin } : {}) } : v))
    await supabase.from('visits').update(patch).eq('id', vid)
  }, [])

  // Delete a session entirely (admin or doctor). Documented/completed sessions
  // are protected. Cleans up the linked unpaid finance line and keeps the
  // parent package's session count in sync (package billing lives admin-side).
  const deleteVisit = useCallback(async (vid, by = 'admin') => {
    const v = visits.find((x) => x.id === vid)
    if (!v) return
    if (v.soapFiled || v.status === 'completed') { notify('admin', 'Cannot delete a documented session'); return }
    setVisits((vs) => vs.filter((x) => x.id !== vid))
    await supabase.from('visits').delete().eq('id', vid)
    // drop the Pending finance line tied to this visit (never touch a Paid one)
    const fin = finances.find((f) => f.visitId === vid)
    if (fin && fin.status !== 'Paid') {
      setFinances((fs) => fs.filter((f) => f.visitId !== vid))
      await supabase.from('finances').delete().eq('visit_id', vid)
    }
    if (v.packageId) {
      const pack = packages.find((p) => p.id === v.packageId)
      if (pack) {
        await supabase.from('packages').update({ total_sessions: Math.max(0, (pack.totalSessions || 1) - 1) }).eq('id', v.packageId)
        setPackages((ps) => ps.map((p) => p.id === v.packageId ? { ...p, totalSessions: Math.max(0, (p.totalSessions || 1) - 1) } : p))
      }
    }
    const pname = patients.find((p) => p.id === v.patientId)?.name || '—'
    notify('admin', `Session deleted: ${pname}${v.date ? ` (${v.date})` : ''}${by === 'doctor' ? ` — by ${v.doctorName}` : ''}`, null, { patientId: v.patientId })
  }, [visits, finances, packages, patients, notify])

  const submitNote = useCallback(async (n) => {
    const today = new Date().toISOString().slice(0, 10)
    // The doctor sets the date the session actually took place. created_at
    // (DB default now()) records when the note was really filed, so admin can
    // see any gap between the two — back-dated or future-dated entries.
    const sessionDate = n.sessionDate || today
    const noteRow = { ...n, state: 'submitted', date: sessionDate }
    const { data: noteData, error: noteErr } = await supabase.from('notes').insert(toNote(noteRow)).select().single()
    if (noteErr) { console.error('submitNote', noteErr); return }
    const inserted = fromNote(noteData)
    setNotes((ns) => [...ns, inserted])

    // mark visit completed (or create independent one)
    let completedVisitId = n.visitId
    const existingVisit = visits.find((v) => v.id === n.visitId)
    if (existingVisit) {
      await supabase.from('visits').update({ status: 'completed', soap_filed: true }).eq('id', n.visitId)
      setVisits((vs) => vs.map((v) => v.id === n.visitId ? { ...v, status: 'completed', soapFiled: true } : v))
    } else {
      const { data: vd } = await supabase.from('visits').insert({
        patient_id: n.patientId, doctor_name: n.doctorName, type: n.type, time: 'logged', status: 'completed', soap_filed: true,
      }).select().single()
      if (vd) { setVisits((vs) => [...vs, fromVisit(vd)]); completedVisitId = vd.id }
    }

    // next session?
    if (n.nextSessionDate) {
      const { data: nv } = await supabase.from('visits').insert({
        patient_id: n.patientId, doctor_name: n.doctorName, type: 'Treatment', time: n.nextSessionTime || '—', date: n.nextSessionDate, status: 'scheduled',
      }).select().single()
      if (nv) setVisits((vs) => [...vs, fromVisit(nv)])
    }

    // patient.dx default + activate
    const pt = patients.find((p) => p.id === n.patientId)
    if (pt && !pt.dx && n.dx) {
      await supabase.from('patients').update({ dx: n.dx }).eq('id', n.patientId)
      setPatients((ps) => ps.map((p) => p.id === n.patientId ? { ...p, dx: n.dx } : p))
    }
    if (pt && pt.status !== 'active') changeStatus(n.patientId, 'active', `First note logged by ${n.doctorName}`, 'System')

    // finance entry — only if this visit wasn't already billed at booking time
    // (sessions are now billed the moment they're created, linked by visit_id).
    if (!completedVisitId || !finances.some((f) => f.visitId === completedVisitId)) {
      const fin = {
        date: today, doctor: n.doctorName, patient: n.patientName, type: n.type,
        fee: config.defaultFee, pct: config.defaultPct, status: 'Pending', method: 'Cash',
        visit_id: completedVisitId || null,
      }
      const { data: fd } = await supabase.from('finances').insert(fin).select().single()
      if (fd) setFinances((fs) => [...fs, fromFinance(fd)])
    }

    notify('admin', `${n.doctorName} submitted a ${n.type} note for ${n.patientName} — awaiting review`, null, { view: 'review', patientId: n.patientId })
    // Flag back-dated / future-dated entries so admin notices timing mismatches.
    if (sessionDate !== today) {
      const diff = Math.round((new Date(today) - new Date(sessionDate)) / 86400000)
      const msg = diff > 0
        ? `⏱ ${n.doctorName} logged a ${n.type} note ${diff} day${diff === 1 ? '' : 's'} late — session ${sessionDate}, filed ${today} (${n.patientName})`
        : `⚠ ${n.doctorName} filed a ${n.type} note dated in the future — session ${sessionDate}, filed ${today} (${n.patientName})`
      notify('admin', msg, null, { view: 'review', patientId: n.patientId })
    }
    if (n.redFlag) notify('admin', `⚠ Red flag raised by ${n.doctorName} for ${n.patientName}`, null, { view: 'review', patientId: n.patientId })
  }, [visits, patients, finances, config, changeStatus, notify])

  const reviewNote = useCallback(async (id, s) => {
    const n = notes.find((x) => x.id === id)
    setNotes((ns) => ns.map((x) => x.id === id ? { ...x, state: s, reviewedAt: nowISO() } : x))
    await supabase.from('notes').update({ state: s, reviewed_at: nowISO() }).eq('id', id)
    const word = s === 'approved' ? 'approved' : s === 'approved_comment' ? 'approved with a comment' : 'sent back for revision'
    if (n) notify('doctor', `Your ${n.type} note for ${n.patientName} was ${word}`, n.doctorName, { patientId: n.patientId })
  }, [notes, notify])

  const openNoteForReview = useCallback(async (id) => {
    setNotes((ns) => ns.map((x) => x.id === id && x.state === 'submitted' ? { ...x, state: 'under_review', openedAt: nowISO() } : x))
    await supabase.from('notes').update({ state: 'under_review', opened_at: nowISO() }).eq('id', id).eq('state', 'submitted')
  }, [])

  const addDoctor = useCallback(async (d) => {
    const { data, error } = await supabase.from('doctors').insert(toDoctor({ ...d, files: [], slots: d.slots || [] })).select().single()
    if (error) { console.error('addDoctor', error); return }
    setDoctors((ds) => [...ds, fromDoctor(data)])
    notify('admin', `Doctor added: ${d.name}`)
  }, [notify])

  const removeDoctor = useCallback(async (id) => {
    const d = doctors.find((x) => x.id === id)
    setDoctors((ds) => ds.filter((x) => x.id !== id))
    await supabase.from('doctors').delete().eq('id', id)
    if (d) notify('admin', `Doctor removed: ${d.name}`)
  }, [doctors, notify])

  const dischargePatient = useCallback(async (pid, report) => {
    const pt = patients.find((p) => p.id === pid)
    setPatients((ps) => ps.map((p) => p.id === pid ? { ...p, discharge: report } : p))
    await supabase.from('patients').update({ discharge: report }).eq('id', pid)
    changeStatus(pid, 'discharged', `${report?.improvePct ?? 0}% improvement over ${report?.sessions ?? 0} sessions`)
    notify('admin', `${pt?.name || 'Patient'} discharged — ${report?.improvePct ?? 0}% improvement over ${report?.sessions ?? 0} sessions`, null, { patientId: pid })
  }, [patients, changeStatus, notify])

  // Permanently delete a patient and everything tied to them (visits, notes,
  // packages). packages.patient_id is NO ACTION, so children are removed in
  // order to avoid FK violations. finances are keyed by patient name, not id,
  // so they are left in the books as historical revenue.
  const removePatient = useCallback(async (pid) => {
    const pt = patients.find((p) => p.id === pid)
    // optimistic local cleanup
    setPatients((ps) => ps.filter((p) => p.id !== pid))
    setVisits((vs) => vs.filter((v) => v.patientId !== pid))
    setNotes((ns) => ns.filter((n) => n.patientId !== pid))
    setPackages((pk) => pk.filter((x) => x.patientId !== pid))
    // delete children first, then the patient
    await supabase.from('visits').delete().eq('patient_id', pid)
    await supabase.from('notes').delete().eq('patient_id', pid)
    await supabase.from('packages').delete().eq('patient_id', pid)
    const { error } = await supabase.from('patients').delete().eq('id', pid)
    if (error) { console.error('removePatient', error); return }
    notify('admin', `Patient deleted: ${pt?.name || 'Unknown'}`)
  }, [patients, notify])

  // Bulk delete: same FK-safe order as removePatient, but one round-trip per
  // table using `.in(...)` instead of N separate deletes.
  const removePatients = useCallback(async (ids) => {
    if (!ids || ids.length === 0) return
    const set = new Set(ids)
    setPatients((ps) => ps.filter((p) => !set.has(p.id)))
    setVisits((vs) => vs.filter((v) => !set.has(v.patientId)))
    setNotes((ns) => ns.filter((n) => !set.has(n.patientId)))
    setPackages((pk) => pk.filter((x) => !set.has(x.patientId)))
    await supabase.from('visits').delete().in('patient_id', ids)
    await supabase.from('notes').delete().in('patient_id', ids)
    await supabase.from('packages').delete().in('patient_id', ids)
    const { error } = await supabase.from('patients').delete().in('id', ids)
    if (error) { console.error('removePatients', error); return }
    notify('admin', `${ids.length} patient${ids.length > 1 ? 's' : ''} deleted`)
  }, [notify])

  const updateDoctorSlots = useCallback(async (id, slots, actor = 'admin') => {
    const d = doctors.find((x) => x.id === id)
    setDoctors((ds) => ds.map((x) => x.id === id ? { ...x, slots } : x))
    await supabase.from('doctors').update({ slots }).eq('id', id)
    if (actor === 'doctor') notify('admin', `${d?.name || 'A doctor'} updated their availability (${slots.length} slots/wk)`, null, { view: 'doctors', doctorId: id })
    else notify('doctor', `Admin updated your availability (${slots.length} slots/wk)`, d?.name, { view: 'avail' })
  }, [doctors, notify])

  const updateDoctorZones = useCallback(async (id, zones, actor = 'admin') => {
    const d = doctors.find((x) => x.id === id)
    setDoctors((ds) => ds.map((x) => x.id === id ? { ...x, zones } : x))
    await supabase.from('doctors').update({ zones }).eq('id', id)
    if (actor === 'doctor') notify('admin', `${d?.name || 'A doctor'} updated their coverage zones (${zones.length})`, null, { view: 'doctors', doctorId: id })
    else notify('doctor', `Admin updated your coverage zones (${zones.length})`, d?.name, { view: 'avail' })
  }, [doctors, notify])

  // patch is camelCase from the UI; map the multi-word keys to snake_case columns.
  const _FIN_COL = { paidOut: 'paid_out', paidOutDate: 'paid_out_date', visitId: 'visit_id' }
  const updateFinance = useCallback(async (id, patch) => {
    setFinances((fs) => fs.map((f) => f.id === id ? { ...f, ...patch } : f))
    const dbPatch = {}
    Object.entries(patch).forEach(([k, v]) => { dbPatch[_FIN_COL[k] || k] = v })
    await supabase.from('finances').update(dbPatch).eq('id', id)
  }, [])

  // Mark a batch of session lines as paid-out (doctor settlement) — or un-settle.
  const settleFinances = useCallback(async (ids, settled) => {
    if (!ids || !ids.length) return
    const date = settled ? new Date().toISOString().slice(0, 10) : null
    setFinances((fs) => fs.map((f) => ids.includes(f.id) ? { ...f, paidOut: settled, paidOutDate: date } : f))
    await supabase.from('finances').update({ paid_out: settled, paid_out_date: date }).in('id', ids)
  }, [])

  // ---- EXPENSES (operational spend + marketing CAC) ----
  const addExpense = useCallback(async (e) => {
    const { data, error } = await supabase.from('expenses').insert(toExpense(e)).select().single()
    if (error) { console.error('addExpense', error); return }
    setExpenses((xs) => [...xs, fromExpense(data)])
    notify('admin', `Expense logged: ${e.category}${e.label ? ` · ${e.label}` : ''} — ${e.amount} (${e.month})`, null, { view: 'finances' })
  }, [notify])

  const updateExpense = useCallback(async (id, patch) => {
    setExpenses((xs) => xs.map((x) => x.id === id ? { ...x, ...patch } : x))
    const clean = {}
    if ('month' in patch) clean.month = patch.month
    if ('category' in patch) clean.category = patch.category
    if ('label' in patch) clean.label = patch.label ? patch.label.trim() : null
    if ('amount' in patch) clean.amount = patch.amount === '' || patch.amount == null ? 0 : Number(patch.amount)
    if ('note' in patch) clean.note = patch.note ? patch.note.trim() : null
    await supabase.from('expenses').update(clean).eq('id', id)
  }, [])

  const removeExpense = useCallback(async (id) => {
    setExpenses((xs) => xs.filter((x) => x.id !== id))
    await supabase.from('expenses').delete().eq('id', id)
  }, [])

  // ---- GROWTH MONTHS (manual P&L / CAC ledger) ----
  const addGrowthMonth = useCallback(async (g) => {
    const { data, error } = await supabase.from('growth_months').upsert(toGrowth(g), { onConflict: 'month' }).select().single()
    if (error) { console.error('addGrowthMonth', error); return }
    const row = fromGrowth(data)
    setGrowthMonths((gs) => [...gs.filter((x) => x.month !== row.month), row].sort((a, b) => (a.month || '').localeCompare(b.month || '')))
  }, [])

  const updateGrowthMonth = useCallback(async (id, patch) => {
    setGrowthMonths((gs) => gs.map((x) => x.id === id ? { ...x, ...patch } : x))
    const clean = {}
    if ('month' in patch) clean.month = patch.month
    if ('newPatients' in patch) clean.new_patients = patch.newPatients === '' || patch.newPatients == null ? 0 : Number(patch.newPatients)
    if ('moneyIn' in patch) clean.money_in = patch.moneyIn === '' || patch.moneyIn == null ? 0 : Number(patch.moneyIn)
    if ('moneyOut' in patch) clean.money_out = patch.moneyOut === '' || patch.moneyOut == null ? 0 : Number(patch.moneyOut)
    if ('marketing' in patch) clean.marketing = patch.marketing === '' || patch.marketing == null ? 0 : Number(patch.marketing)
    if ('note' in patch) clean.note = patch.note ? patch.note.trim() : null
    await supabase.from('growth_months').update(clean).eq('id', id)
  }, [])

  const removeGrowthMonth = useCallback(async (id) => {
    setGrowthMonths((gs) => gs.filter((x) => x.id !== id))
    await supabase.from('growth_months').delete().eq('id', id)
  }, [])

  const updateVisitStatus = useCallback(async (vid, status, by = null) => {
    const patch = { status }
    if (status === 'cancelled') patch.cancelled_by = by || 'admin'
    setVisits((vs) => vs.map((v) => v.id === vid ? { ...v, status, cancelledBy: status === 'cancelled' ? (by || 'admin') : v.cancelledBy } : v))
    await supabase.from('visits').update(patch).eq('id', vid)
    const v = visits.find((x) => x.id === vid)
    if (v) {
      const pt = patients.find((p) => p.id === v.patientId)
      const tail = status === 'cancelled' ? ` (by ${by || 'admin'})` : ''
      notify('admin', `${pt?.name || 'Visit'} → ${status}${tail}`, null, { patientId: v.patientId })
      // Cancelling a session voids its still-unpaid billing line so the books
      // don't carry revenue for a session that never happened.
      if (status === 'cancelled') {
        const pend = finances.find((f) => f.visitId === vid && f.status === 'Pending')
        if (pend) {
          setFinances((fs) => fs.filter((f) => f.id !== pend.id))
          await supabase.from('finances').delete().eq('id', pend.id)
        }
      }
      // When a session is marked completed, generate its billing entry once
      // (guarded by visit_id so a later SOAP note won't double-bill the same visit).
      if (status === 'completed' && !finances.some((f) => f.visitId === vid)) {
        const fin = {
          date: v.date || new Date().toISOString().slice(0, 10), doctor: v.doctorName,
          patient: pt?.name || '—', type: v.type || 'Treatment',
          fee: config.defaultFee, pct: config.defaultPct, status: 'Pending', method: 'Cash',
          visit_id: vid,
        }
        const { data: fd } = await supabase.from('finances').insert(fin).select().single()
        if (fd) setFinances((fs) => [...fs, fromFinance(fd)])
      }
    }
  }, [visits, patients, finances, config, notify])

  // ---- TASKS (shared idea / task board) ----
  const addTask = useCallback(async (t) => {
    const row = { ...t, createdBy: role === 'admin' ? 'admin' : meRef.current }
    const { data, error } = await supabase.from('tasks').insert(toTask(row)).select().single()
    if (error) { console.error('addTask', error); return }
    const ins = fromTask(data)
    localTaskWrites.current.set(ins.id, Date.now())
    setTasks((ts) => ts.some((x) => x.id === ins.id) ? ts : [ins, ...ts])
  }, [role])

  const updateTask = useCallback(async (id, patch) => {
    let next = null
    setTasks((ts) => ts.map((t) => { if (t.id !== id) return t; next = { ...t, ...patch }; return next }))
    localTaskWrites.current.set(id, Date.now())
    const dbPatch = {}
    if ('title' in patch) dbPatch.title = patch.title ? patch.title.trim() : ''
    if ('detail' in patch) dbPatch.detail = patch.detail ? patch.detail.trim() : null
    if ('kind' in patch) dbPatch.kind = patch.kind
    if ('assignee' in patch) dbPatch.assignee = patch.assignee
    if ('priority' in patch) dbPatch.priority = patch.priority
    if ('dueDate' in patch) dbPatch.due_date = patch.dueDate || null
    if ('status' in patch) { dbPatch.status = patch.status; dbPatch.done_at = patch.status === 'done' ? nowISO() : null }
    await supabase.from('tasks').update(dbPatch).eq('id', id)
  }, [])

  const removeTask = useCallback(async (id) => {
    localTaskWrites.current.set(id, Date.now())
    setTasks((ts) => ts.filter((t) => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }, [])

  const updateConfig = useCallback(async (patch) => {
    const next = { ...config, ...patch }
    setConfigState(next)
    await supabase.from('config').update(toConfig(next)).eq('id', 1)
  }, [config])

  // exercise / modality library mutators
  const setExerciseLibPersisted = useCallback(async (next) => {
    // simplified: caller passes the full next array (matches App.jsx). We diff naively:
    // for simplicity, just write any new entries (those without an id), update existing.
    setExerciseLib(next)
    for (const e of next) {
      if (e.id && typeof e.id === 'number' && e.id > 0 && e.id < 1e10) {
        await supabase.from('exercises').update(toExercise(e)).eq('id', e.id)
      } else {
        const { data } = await supabase.from('exercises').insert(toExercise(e)).select().single()
        if (data) setExerciseLib((arr) => arr.map((x) => x === e ? fromExercise(data) : x))
      }
    }
  }, [])

  const setModalityLibPersisted = useCallback(async (next) => {
    setModalityLib(next)
    for (const m of next) {
      if (m.id) {
        await supabase.from('modalities').update(toModality(m)).eq('id', m.id)
      } else {
        const { data } = await supabase.from('modalities').insert(toModality(m)).select().single()
        if (data) setModalityLib((arr) => arr.map((x) => x === m ? fromModality(data) : x))
      }
    }
  }, [])

  // ---- PACKAGE MUTATIONS ----
  // Creates the package row, then N child session slots (visits). For
  // pre-scheduled packages, `dates[i]` seeds each slot's date; rolling
  // packages leave dates empty (added later via assignSessionDate).
  const addPackage = useCallback(async (pkg, dates = []) => {
    const pt = patients.find((p) => p.id === pkg.patientId)
    const row = { ...pkg, patientName: pt?.name || pkg.patientName || '' }
    const { data: pdata, error: perr } = await supabase.from('packages').insert(toPackage(row)).select().single()
    if (perr) { console.error('addPackage', perr); return null }
    const pack = fromPackage(pdata)
    setPackages((ps) => [...ps, pack])

    const n = Math.max(1, pkg.totalSessions || 1)
    const slots = Array.from({ length: n }, (_, i) => ({
      patient_id: pack.patientId,
      doctor_name: pack.doctorName,
      type: i === 0 ? 'Assessment' : 'Treatment',
      time: '—',
      date: dates[i] || null,
      status: 'scheduled',
      package_id: pack.id,
      package_seq: i + 1,
    }))
    const { data: vdata } = await supabase.from('visits').insert(slots).select()
    if (vdata) setVisits((vs) => [...vs, ...vdata.map(fromVisit)])
    notify('admin', `Package created: ${pack.title || 'plan'} for ${pack.patientName} — ${n} sessions`, null, { patientId: pack.patientId })
    if (pack.doctorName) notify('doctor', `New treatment package assigned: ${pack.patientName} — ${pack.title || 'plan'} (${n} sessions)`, pack.doctorName, { patientId: pack.patientId })
    return pack
  }, [patients, notify])

  const assignSessionDate = useCallback(async (vid, date) => {
    setVisits((vs) => vs.map((v) => v.id === vid ? { ...v, date } : v))
    await supabase.from('visits').update({ date }).eq('id', vid)
  }, [])

  const addPackageSlot = useCallback(async (packageId) => {
    const pack = packages.find((p) => p.id === packageId)
    if (!pack) return
    const seq = visits.filter((v) => v.packageId === packageId).length + 1
    const { data } = await supabase.from('visits').insert({
      patient_id: pack.patientId, doctor_name: pack.doctorName, type: 'Treatment',
      time: '—', date: null, status: 'scheduled', package_id: packageId, package_seq: seq,
    }).select().single()
    if (data) setVisits((vs) => [...vs, fromVisit(data)])
    await supabase.from('packages').update({ total_sessions: (pack.totalSessions || 0) + 1 }).eq('id', packageId)
    setPackages((ps) => ps.map((p) => p.id === packageId ? { ...p, totalSessions: (p.totalSessions || 0) + 1 } : p))
    notify('admin', `Slot added to ${pack.title || 'package'} (${pack.patientName})`)
  }, [packages, visits, notify])

  const removePackageSlot = useCallback(async (vid, reason) => {
    const v = visits.find((x) => x.id === vid)
    if (!v) return
    if (v.soapFiled) { notify('admin', 'Cannot remove a documented session'); return }
    setVisits((vs) => vs.filter((x) => x.id !== vid))
    await supabase.from('visits').delete().eq('id', vid)
    if (v.packageId) {
      const pack = packages.find((p) => p.id === v.packageId)
      if (pack) {
        await supabase.from('packages').update({ total_sessions: Math.max(0, (pack.totalSessions || 1) - 1) }).eq('id', v.packageId)
        setPackages((ps) => ps.map((p) => p.id === v.packageId ? { ...p, totalSessions: Math.max(0, (p.totalSessions || 1) - 1) } : p))
        notify('admin', `Slot removed from ${pack.title || 'package'}${reason ? ` — ${reason}` : ''}`)
      }
    }
  }, [visits, packages, notify])

  const reassignPackageDoctor = useCallback(async (packageId, name) => {
    setPackages((ps) => ps.map((p) => p.id === packageId ? { ...p, doctorName: name } : p))
    await supabase.from('packages').update({ doctor_name: name }).eq('id', packageId)
    // move not-yet-documented sessions to the new doctor; completed ones stay attributed
    const open = visits.filter((v) => v.packageId === packageId && !v.soapFiled)
    for (const v of open) {
      await supabase.from('visits').update({ doctor_name: name }).eq('id', v.id)
    }
    setVisits((vs) => vs.map((v) => v.packageId === packageId && !v.soapFiled ? { ...v, doctorName: name } : v))
    notify('admin', `Package reassigned to ${name}`)
    if (name) notify('doctor', `A treatment package was reassigned to you`, name)
  }, [visits, notify])

  const updatePackage = useCallback(async (packageId, patch) => {
    setPackages((ps) => ps.map((p) => p.id === packageId ? { ...p, ...patch } : p))
    const pack = packages.find((p) => p.id === packageId)
    await supabase.from('packages').update(toPackage({ ...pack, ...patch })).eq('id', packageId)
  }, [packages])

  const endPackage = useCallback(async (packageId, reason) => {
    setPackages((ps) => ps.map((p) => p.id === packageId ? { ...p, status: 'ended' } : p))
    await supabase.from('packages').update({ status: 'ended' }).eq('id', packageId)
    // archive remaining undocumented slots
    const open = visits.filter((v) => v.packageId === packageId && !v.soapFiled && v.status !== 'completed')
    for (const v of open) await supabase.from('visits').update({ status: 'cancelled', cancelled_by: 'admin' }).eq('id', v.id)
    setVisits((vs) => vs.map((v) => v.packageId === packageId && !v.soapFiled && v.status !== 'completed' ? { ...v, status: 'cancelled', cancelledBy: 'admin' } : v))
    const pack = packages.find((p) => p.id === packageId)
    notify('admin', `Package ended${pack ? `: ${pack.patientName}` : ''}${reason ? ` — ${reason}` : ''} — payment reconciliation due`, null, pack ? { patientId: pack.patientId } : null)
  }, [visits, packages, notify])

  // ---- REMINDERS & RESCHEDULE (§3.4, §5) ----
  const fillTemplate = (tmpl, { patient, doctor, date, time }) =>
    (tmpl || '').replace(/{patient}/g, patient || '').replace(/{doctor}/g, doctor || '')
      .replace(/{date}/g, date || '').replace(/{time}/g, time || '')

  // kind: '24h' | '8h' | 'sameday'. Marks the reminder sent, moves a fresh
  // session into pending_confirmation, and notifies the patient channel.
  const sendReminder = useCallback(async (vid, kind) => {
    const v = visits.find((x) => x.id === vid)
    if (!v) return
    const pt = patients.find((p) => p.id === v.patientId)
    const tmpl = kind === '24h' ? config.tmpl24h : kind === '8h' ? config.tmpl8h : config.tmplSameday
    const msg = fillTemplate(tmpl, { patient: pt?.name, doctor: v.doctorName, date: v.date, time: v.time })
    // Open WhatsApp first (synchronous, inside the click gesture) so the pre-filled
    // message is ready to send — no Business API needed. Admin presses send.
    const opened = pt?.phone ? openWhatsApp(pt.phone, msg) : false
    const col = kind === '24h' ? 'reminder_24h' : kind === '8h' ? 'reminder_8h' : 'reminder_sameday'
    const camel = kind === '24h' ? 'reminder24h' : kind === '8h' ? 'reminder8h' : 'reminderSameday'
    const patch = { [col]: true }
    const nextStatus = v.status === 'scheduled' ? 'pending_confirmation' : v.status
    if (nextStatus !== v.status) patch.status = nextStatus
    setVisits((vs) => vs.map((x) => x.id === vid ? { ...x, [camel]: true, status: nextStatus } : x))
    await supabase.from('visits').update(patch).eq('id', vid)
    notify('admin', `WhatsApp reminder (${kind}) ${opened ? 'opened for' : 'prepared for'} ${pt?.name || 'patient'}${pt?.phone ? '' : ' — no phone on file'}: "${msg}"`, null, { view: 'calendar', patientId: v.patientId })
  }, [visits, patients, config, notify])

  // Doctor cannot cancel directly — this raises a request to admin (§3.3).
  // The doctor must give a reason and a suggested date range (prefFrom..prefTo)
  // so the admin knows when the patient could be re-booked.
  const requestReschedule = useCallback(async (vid, opts, by) => {
    // Back-compat: callers used to pass a bare note string.
    const { note, prefFrom = null, prefTo = null } =
      typeof opts === 'string' ? { note: opts } : (opts || {})
    setVisits((vs) => vs.map((x) => x.id === vid
      ? { ...x, rescheduleRequested: true, rescheduleNote: note || null, reschedulePrefFrom: prefFrom, reschedulePrefTo: prefTo }
      : x))
    await supabase.from('visits').update({
      reschedule_requested: true,
      reschedule_note: note || null,
      reschedule_pref_from: prefFrom,
      reschedule_pref_to: prefTo,
    }).eq('id', vid)
    const v = visits.find((x) => x.id === vid)
    const pt = v && patients.find((p) => p.id === v.patientId)
    const range = prefFrom || prefTo ? ` (prefers ${prefFrom || '…'} → ${prefTo || '…'})` : ''
    notify('admin', `${by || 'Doctor'} requested reschedule for ${pt?.name || 'a session'}${note ? ` — ${note}` : ''}${range}`, null, { view: 'calendar' })
  }, [visits, patients, notify])

  // Admin actions a reschedule: clears the request flag + range and (optionally)
  // moves the session to a new date/time, re-activating it as 'scheduled' so it
  // stays visible on the calendar at its new slot.
  const resolveReschedule = useCallback(async (vid, newDate, newTime) => {
    const patch = { reschedule_requested: false, reschedule_note: null, reschedule_pref_from: null, reschedule_pref_to: null }
    const moved = !!newDate
    if (moved) { patch.date = newDate; patch.status = 'scheduled' }
    if (newTime) patch.time = newTime
    setVisits((vs) => vs.map((x) => x.id === vid ? {
      ...x, rescheduleRequested: false, rescheduleNote: null, reschedulePrefFrom: null, reschedulePrefTo: null,
      ...(moved ? { date: newDate, status: 'scheduled' } : {}), ...(newTime ? { time: newTime } : {}),
    } : x))
    await supabase.from('visits').update(patch).eq('id', vid)
  }, [])

  return {
    // data
    doctors, patients, visits, notes, exerciseLib, modalityLib, finances, expenses, growthMonths, config, notifs, packages, tasks,
    loading, error,
    // mutations
    addPatient, assignDoctor, updatePatient, updatePatientStatus, dischargePatient, updatePatientFiles, removePatient, removePatients,
    submitNote, reviewNote, openNoteForReview,
    addDoctor, removeDoctor, updateDoctorSlots, updateDoctorZones,
    updateFinance, settleFinances, addExpense, updateExpense, removeExpense, addGrowthMonth, updateGrowthMonth, removeGrowthMonth, updateVisitStatus, updateConfig,
    addPackage, assignSessionDate, addPackageSlot, removePackageSlot, reassignPackageDoctor, updatePackage, endPackage,
    sendReminder, requestReschedule, resolveReschedule,
    bookSession, rescheduleVisit, deleteVisit,
    addTask, updateTask, removeTask,
    setExerciseLib: setExerciseLibPersisted,
    setModalityLib: setModalityLibPersisted,
    notify, markRead,
    refresh: loadAll,
  }
}
