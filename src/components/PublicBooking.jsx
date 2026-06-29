import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Public, no-login booking page (shared as a link). Patients pick an open
// slot derived from doctors' availability (doctors stay hidden), leave their
// phone + complaint, and submit. The clinic then assigns a doctor, the doctor
// confirms, and the patient gets a WhatsApp confirmation. Bilingual AR/EN.

const C = {
  ink: '#0F2A2E', ink2: '#33474B', teal: '#3FB6A8', tealSoft: '#A9D9D1',
  bg: '#F4F1EA', line: '#E4E0D6', grey: '#7b8a8e', red: '#C0392B', green: '#2E9E6B',
}

const STR = {
  ar: {
    dir: 'rtl', brandSub: 'احجز جلسة علاج طبيعي منزلية',
    intro: 'اختار اليوم والوقت المناسب لك، واسيب رقمك وشكوتك، وفريق Go Doc هيأكد معاك ويبعتلك رسالة واتساب.',
    pickDay: 'اختار اليوم', pickTime: 'اختار الوقت', noSlots: 'لا توجد مواعيد متاحة حاليًا. حاول لاحقًا أو تواصل معنا.',
    yourDetails: 'بياناتك', name: 'الاسم', phone: 'رقم الموبايل (واتساب)', complaint: 'الشكوى الأساسية',
    area: 'المنطقة / العنوان', optional: 'اختياري', required: 'مطلوب',
    back: 'رجوع', book: 'تأكيد الحجز', booking: 'جاري الحجز…',
    chosen: 'الموعد المختار', change: 'تغيير',
    successH: 'تم استلام طلبك ✅',
    successP: 'هنأكد موعدك ونبعتلك رسالة واتساب باسم الدكتور والتفاصيل قريبًا. لو محتاج تعدل، رد على رسالتنا.',
    another: 'حجز موعد آخر', phoneErr: 'من فضلك اكتب رقم موبايل صحيح.',
    weekdays: ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],
    months: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
  },
  en: {
    dir: 'ltr', brandSub: 'Book a home physiotherapy session',
    intro: 'Pick a day and time that suits you, leave your phone and complaint, and the Go Doc team will confirm and message you on WhatsApp.',
    pickDay: 'Choose a day', pickTime: 'Choose a time', noSlots: 'No open times right now. Please try later or contact us.',
    yourDetails: 'Your details', name: 'Name', phone: 'Mobile number (WhatsApp)', complaint: 'Main complaint',
    area: 'Area / address', optional: 'optional', required: 'required',
    back: 'Back', book: 'Confirm booking', booking: 'Booking…',
    chosen: 'Selected time', change: 'Change',
    successH: 'Request received ✅',
    successP: 'We will confirm your appointment and message you on WhatsApp with the doctor name and details shortly. Reply to our message if you need changes.',
    another: 'Book another time', phoneErr: 'Please enter a valid mobile number.',
    weekdays: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  },
}

export default function PublicBooking() {
  const [lang, setLang] = useState('ar')
  const t = STR[lang]
  const ar = lang === 'ar'
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState(null)
  const [time, setTime] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', complaint: '', area: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.rpc('public_available_slots', { days: 14 })
    setSlots(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const byDay = useMemo(() => {
    const m = new Map()
    for (const s of slots) {
      if (!m.has(s.slot_date)) m.set(s.slot_date, [])
      m.get(s.slot_date).push(s.slot_time)
    }
    return [...m.entries()].map(([d, times]) => ({ d, times: times.sort() })).sort((a, b) => a.d.localeCompare(b.d))
  }, [slots])

  const fmtDay = (d) => {
    const dt = new Date(d + 'T00:00:00')
    return `${t.weekdays[dt.getDay()]} ${dt.getDate()} ${t.months[dt.getMonth()]}`
  }

  const submit = async () => {
    setErr('')
    const digits = (form.phone || '').replace(/\D/g, '')
    if (digits.length < 7) { setErr(t.phoneErr); return }
    setBusy(true)
    try {
      const { error } = await supabase.rpc('request_booking', {
        p_name: form.name, p_phone: form.phone, p_complaint: form.complaint,
        p_area: form.area, p_date: day, p_time: time,
      })
      if (error) { setErr(ar ? 'حصل خطأ، حاول تاني.' : 'Something went wrong, please try again.'); return }
      setDone(true)
    } finally { setBusy(false) }
  }

  const card = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16 }
  const input = { width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${C.line}`, fontSize: 15, outline: 'none', background: '#fff', color: C.ink }
  const label = { fontSize: 12, fontWeight: 700, color: C.grey, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '.4px' }

  return (
    <div dir={t.dir} style={{ minHeight: '100vh', background: '#DCE2E4', display: 'flex', justifyContent: 'center', padding: 16, fontFamily: ar ? "'Segoe UI',Tahoma,Arial,sans-serif" : "-apple-system,Segoe UI,Roboto,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* header */}
        <div style={{ background: C.ink, borderRadius: 20, padding: '22px 22px 24px', color: '#fff', marginBottom: 14, position: 'relative' }}>
          <button onClick={() => setLang(ar ? 'en' : 'ar')} style={{ position: 'absolute', top: 16, [ar ? 'left' : 'right']: 16, background: 'rgba(255,255,255,.14)', color: '#fff', border: 'none', borderRadius: 999, padding: '5px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{ar ? 'EN' : 'عربي'}</button>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 800, letterSpacing: '-.5px' }}>Go<span style={{ color: C.teal }}>Doc</span></div>
          <div style={{ color: C.tealSoft, fontSize: 14, marginTop: 4 }}>{t.brandSub}</div>
          {!done && <p style={{ color: '#cfe7e2', fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>{t.intro}</p>}
        </div>

        {done ? (
          <div style={{ ...card, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, fontFamily: 'Georgia,serif' }}>{t.successH}</div>
            <div style={{ marginTop: 8, marginBottom: 6, fontWeight: 700, color: C.teal }}>{fmtDay(day)} · {time}</div>
            <p style={{ color: C.ink2, fontSize: 14, lineHeight: 1.7 }}>{t.successP}</p>
            <button onClick={() => { setDone(false); setDay(null); setTime(null); setForm({ name: '', phone: '', complaint: '', area: '' }); load() }}
              style={{ marginTop: 18, background: C.bg, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{t.another}</button>
          </div>
        ) : loading ? (
          <div style={{ ...card, padding: 28, textAlign: 'center', color: C.grey }}>…</div>
        ) : byDay.length === 0 ? (
          <div style={{ ...card, padding: 28, textAlign: 'center', color: C.grey }}>{t.noSlots}</div>
        ) : !time ? (
          <div style={{ ...card, padding: 18 }}>
            <div style={{ ...label }}>{t.pickDay}</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 6 }}>
              {byDay.map(({ d }) => (
                <button key={d} onClick={() => { setDay(d) }} style={{ flex: '0 0 auto', padding: '10px 14px', borderRadius: 12, border: `1px solid ${day === d ? C.teal : C.line}`, background: day === d ? C.teal : '#fff', color: day === d ? C.ink : C.ink2, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{fmtDay(d)}</button>
              ))}
            </div>
            {day && <>
              <div style={{ ...label, marginTop: 10 }}>{t.pickTime}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {(byDay.find(x => x.d === day)?.times || []).map(tm => (
                  <button key={tm} onClick={() => setTime(tm)} style={{ padding: '12px 0', borderRadius: 12, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{tm}</button>
                ))}
              </div>
            </>}
          </div>
        ) : (
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#EAF6F4', border: `1px solid ${C.tealSoft}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
              <div><div style={{ fontSize: 11, color: C.grey, fontWeight: 700 }}>{t.chosen}</div><div style={{ fontWeight: 800, color: C.ink }}>{fmtDay(day)} · {time}</div></div>
              <button onClick={() => { setTime(null) }} style={{ background: 'none', border: 'none', color: C.teal, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t.change}</button>
            </div>

            <div style={{ ...label }}>{t.name} <span style={{ color: C.grey, textTransform: 'none' }}>· {t.optional}</span></div>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ ...input, marginBottom: 12 }} />

            <div style={{ ...label }}>{t.phone} <span style={{ color: C.red, textTransform: 'none' }}>· {t.required}</span></div>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} inputMode="tel" placeholder="01xxxxxxxxx" style={{ ...input, marginBottom: 12, textAlign: ar ? 'right' : 'left' }} />

            <div style={{ ...label }}>{t.complaint} <span style={{ color: C.grey, textTransform: 'none' }}>· {t.optional}</span></div>
            <textarea value={form.complaint} onChange={e => setForm(f => ({ ...f, complaint: e.target.value }))} rows={2} style={{ ...input, marginBottom: 12, resize: 'none' }} />

            <div style={{ ...label }}>{t.area} <span style={{ color: C.grey, textTransform: 'none' }}>· {t.optional}</span></div>
            <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} style={{ ...input, marginBottom: 12 }} />

            {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}

            <button onClick={submit} disabled={busy} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: C.ink, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? t.booking : t.book}</button>
          </div>
        )}

        <div style={{ textAlign: 'center', color: C.grey, fontSize: 11, marginTop: 14 }}>Go Doc · {ar ? 'علاج طبيعي ورعاية منزلية' : 'Physiotherapy & home care'}</div>
      </div>
    </div>
  )
}
