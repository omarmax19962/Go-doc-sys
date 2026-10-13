/* alerts.js — client side of the doctor alert system (server: supabase/functions/alert-dispatch).
 * useDoctorAlerts() keeps the doctor's open alerts live; useAttention() makes an
 * unacknowledged alert impossible to miss while the app is open (tab title, app badge,
 * vibration, sound). A closed app is covered by Web Push (push.js + public/sw.js). */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

/* An alert "needs attention" when it is open AND either never acknowledged, or the server
 * pinged again after the last ack (the grace period ran out and the duty is still there). */
export const needsAttention = (a) =>
  a.status === 'open' && (!a.acked_at || (a.last_sent_at && a.last_sent_at > a.acked_at))

const SEV = { critical: 0, high: 1, normal: 2 }
export const sortAlerts = (list) => [...list].sort((a, b) =>
  (SEV[a.severity] ?? 2) - (SEV[b.severity] ?? 2) ||
  (Date.parse(a.deadline_at || '9999') - Date.parse(b.deadline_at || '9999')) ||
  a.id - b.id)

export function useDoctorAlerts(me) {
  const [rows, setRows] = useState([])
  const meRef = useRef(me)
  useEffect(() => { meRef.current = me }, [me])

  const load = useCallback(async () => {
    if (!meRef.current) return
    const { data, error } = await supabase.from('doctor_alerts').select('*')
      .eq('doctor_name', meRef.current).eq('status', 'open')
    // The table may not exist until the migration is run — stay silent, the app works without it.
    if (!error) setRows(data || [])
  }, [])

  useEffect(() => {
    if (!me) return
    load()
    const ch = supabase.channel(`doctor-alerts-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_alerts' }, load)
      .subscribe()
    const poll = setInterval(load, 60000)                       // realtime can drop; the cron ticks every minute
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    const onMsg = (e) => { if (e.data && e.data.type === 'godoc-alert') load() }  // push just arrived
    document.addEventListener('visibilitychange', onVis)
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => {
      supabase.removeChannel(ch); clearInterval(poll)
      document.removeEventListener('visibilitychange', onVis)
      navigator.serviceWorker?.removeEventListener('message', onMsg)
    }
  }, [me, load])

  const ack = useCallback(async (id) => {
    const nowIso = new Date().toISOString()
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, acked_at: nowIso } : r)) // optimistic: close the takeover instantly
    const { error } = await supabase.rpc('ack_doctor_alert', { p_id: id })
    if (error) { console.warn('[alerts] ack failed', error); load() }            // snap back to server truth
    else load()
  }, [load])

  return { alerts: rows, needs: sortAlerts(rows.filter(needsAttention)), ack }
}

let audioCtx
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const t = audioCtx.currentTime
    ;[[880, 0], [660, 0.18], [880, 0.36]].forEach(([f, d]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain()
      o.type = 'square'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15)
      o.connect(g); g.connect(audioCtx.destination); o.start(t + d); o.stop(t + d + 0.16)
    })
  } catch { /* autoplay blocked until the first tap — the visual takeover still works */ }
}

/* While `count` > 0: flash the tab title, set the app-icon badge, and buzz/beep now and every 25 s. */
export function useAttention(count, { sound = true } = {}) {
  useEffect(() => {
    if (!count) {
      try { navigator.clearAppBadge?.() } catch { /* unsupported */ }
      return
    }
    try { navigator.setAppBadge?.(count) } catch { /* unsupported */ }
    const base = document.title.replace(/^🔴 \(\d+\) ACTION NEEDED · /, '')
    let on = false
    const flash = setInterval(() => { on = !on; document.title = on ? `🔴 (${count}) ACTION NEEDED · ${base}` : base }, 1000)
    const buzz = () => { try { navigator.vibrate?.([300, 100, 300, 100, 600]) } catch { /* unsupported */ } if (sound) beep() }
    buzz()
    const loud = setInterval(buzz, 25000)
    return () => { clearInterval(flash); clearInterval(loud); document.title = base }
  }, [count, sound])
}
