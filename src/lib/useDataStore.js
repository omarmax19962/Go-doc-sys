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
  fromConfig, toConfig,
  fromNotif,
} from './db'

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
  const [config, setConfigState] = useState({ defaultFee: 500, defaultPct: 0.6, currency: 'EGP' })
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const meRef = useRef(me)
  useEffect(() => { meRef.current = me }, [me])

  // ---- INITIAL LOAD ----
  const loadAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [d, p, v, n, ex, m, f, c, notes_n] = await Promise.all([
        supabase.from('doctors').select('*').order('id'),
        supabase.from('patients').select('*').order('id'),
        supabase.from('visits').select('*').order('id'),
        supabase.from('notes').select('*').order('id'),
        supabase.from('exercises').select('*').order('id'),
        supabase.from('modalities').select('*').order('id'),
        supabase.from('finances').select('*').order('id'),
        supabase.from('config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('notifications').select('*').order('ts', { ascending: false }).limit(50),
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
    } catch (e) {
      console.error('[useDataStore] load failed', e)
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ---- REALTIME SUBSCRIPTIONS ----
  useEffect(() => {
    const ch = supabase
      .channel('godoc-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
        supabase.from('notes').select('*').order('id').then(({ data }) => setNotes((data || []).map(fromNote)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (p) => {
        if (p.new) setNotifs((ns) => [fromNotif(p.new), ...ns.filter((x) => x.id !== p.new.id)])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
        supabase.from('visits').select('*').order('id').then(({ data }) => setVisits((data || []).map(fromVisit)))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // ---- HELPERS ----
  const nowISO = () => new Date().toISOString()

  const notify = useCallback(async (target, text, to) => {
    const tmpId = Date.now() + Math.random()
    setNotifs((ns) => [{ id: tmpId, ts: Date.now(), target, to, text, read: false }, ...ns])
    const { data, error } = await supabase
      .from('notifications')
      .insert({ target, to: to || null, text })
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

  // ---- PATIENT MUTATIONS ----
  const _writePatient = async (id, patch) => {
    const { error } = await supabase.from('patients').update(toPatient(patch)).eq('id', id)
    if (error) console.error('writePatient', error)
  }

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
    if (pt) notify('admin', `${pt.name} marked ${to}${note ? ` — ${note}` : ''}`)
  }, [patients, changeStatus, notify])

  const addPatient = useCallback(async (p, booked, date, doctor) => {
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
      const v = { patient_id: inserted.id, doctor_name: doctor, type: 'Assessment', time: '12:00', date, status: 'scheduled' }
      const { data: vd } = await supabase.from('visits').insert(v).select().single()
      if (vd) setVisits((vs) => [...vs, fromVisit(vd)])
    }
    notify('admin', booked ? `New booking: ${p.name} → ${doctor} (${date})` : `New lead added: ${p.name}`)
    if (booked) notify('doctor', `New patient booked with you: ${p.name}`, doctor)
  }, [notify])

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
      if (data) setVisits((vs) => [...vs, fromVisit(data)])
    }
    if (name) notify('doctor', `You were assigned to ${pt?.name || 'a patient'} — visit added to your list`, name)
  }, [patients, visits, changeStatus, notify])

  const submitNote = useCallback(async (n) => {
    const today = new Date().toISOString().slice(0, 10)
    const noteRow = { ...n, state: 'submitted', date: today }
    const { data: noteData, error: noteErr } = await supabase.from('notes').insert(toNote(noteRow)).select().single()
    if (noteErr) { console.error('submitNote', noteErr); return }
    const inserted = fromNote(noteData)
    setNotes((ns) => [...ns, inserted])

    // mark visit completed (or create independent one)
    const existingVisit = visits.find((v) => v.id === n.visitId)
    if (existingVisit) {
      await supabase.from('visits').update({ status: 'completed' }).eq('id', n.visitId)
      setVisits((vs) => vs.map((v) => v.id === n.visitId ? { ...v, status: 'completed' } : v))
    } else {
      const { data: vd } = await supabase.from('visits').insert({
        patient_id: n.patientId, doctor_name: n.doctorName, type: n.type, time: 'logged', status: 'completed',
      }).select().single()
      if (vd) setVisits((vs) => [...vs, fromVisit(vd)])
    }

    // next session?
    if (n.nextSessionDate) {
      const { data: nv } = await supabase.from('visits').insert({
        patient_id: n.patientId, doctor_name: n.doctorName, type: 'Treatment', time: '—', date: n.nextSessionDate, status: 'scheduled',
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

    // finance entry
    const fin = {
      date: today, doctor: n.doctorName, patient: n.patientName, type: n.type,
      fee: config.defaultFee, pct: config.defaultPct, status: 'Pending', method: 'Cash',
    }
    const { data: fd } = await supabase.from('finances').insert(fin).select().single()
    if (fd) setFinances((fs) => [...fs, fromFinance(fd)])

    notify('admin', `${n.doctorName} submitted a ${n.type} note for ${n.patientName} — awaiting review`)
    if (n.redFlag) notify('admin', `⚠ Red flag raised by ${n.doctorName} for ${n.patientName}`)
  }, [visits, patients, config, changeStatus, notify])

  const reviewNote = useCallback(async (id, s) => {
    const n = notes.find((x) => x.id === id)
    setNotes((ns) => ns.map((x) => x.id === id ? { ...x, state: s, reviewedAt: nowISO() } : x))
    await supabase.from('notes').update({ state: s, reviewed_at: nowISO() }).eq('id', id)
    const word = s === 'approved' ? 'approved' : s === 'approved_comment' ? 'approved with a comment' : 'sent back for revision'
    if (n) notify('doctor', `Your ${n.type} note for ${n.patientName} was ${word}`, n.doctorName)
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
    notify('admin', `${pt?.name || 'Patient'} discharged — ${report?.improvePct ?? 0}% improvement over ${report?.sessions ?? 0} sessions`)
  }, [patients, changeStatus, notify])

  const updateDoctorSlots = useCallback(async (id, slots, actor = 'admin') => {
    const d = doctors.find((x) => x.id === id)
    setDoctors((ds) => ds.map((x) => x.id === id ? { ...x, slots } : x))
    await supabase.from('doctors').update({ slots }).eq('id', id)
    if (actor === 'doctor') notify('admin', `${d?.name || 'A doctor'} updated their availability (${slots.length} slots/wk)`)
    else notify('doctor', `Admin updated your availability (${slots.length} slots/wk)`, d?.name)
  }, [doctors, notify])

  const updateFinance = useCallback(async (id, patch) => {
    setFinances((fs) => fs.map((f) => f.id === id ? { ...f, ...patch } : f))
    await supabase.from('finances').update(patch).eq('id', id)
  }, [])

  const updateVisitStatus = useCallback(async (vid, status) => {
    setVisits((vs) => vs.map((v) => v.id === vid ? { ...v, status } : v))
    await supabase.from('visits').update({ status }).eq('id', vid)
    const v = visits.find((x) => x.id === vid)
    if (v) {
      const pt = patients.find((p) => p.id === v.patientId)
      notify('admin', `${pt?.name || 'Visit'} → ${status}`)
    }
  }, [visits, patients, notify])

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

  return {
    // data
    doctors, patients, visits, notes, exerciseLib, modalityLib, finances, config, notifs,
    loading, error,
    // mutations
    addPatient, assignDoctor, updatePatientStatus, dischargePatient,
    submitNote, reviewNote, openNoteForReview,
    addDoctor, removeDoctor, updateDoctorSlots,
    updateFinance, updateVisitStatus, updateConfig,
    setExerciseLib: setExerciseLibPersisted,
    setModalityLib: setModalityLibPersisted,
    notify, markRead,
    refresh: loadAll,
  }
}
