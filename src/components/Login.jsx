import { useState } from 'react'
import { supabase, hasSupabaseConfig } from '../lib/supabase'

const C = { ink: '#0F2A2E', teal: '#3FB6A8', tealSoft: '#A9D9D1', bg: '#F4F1EA' }

export default function Login({ onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
    else onSignedIn?.()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#C9CDC9' }}>
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl p-8 shadow-lg"
        style={{ background: C.bg, border: `1px solid ${C.tealSoft}` }}
      >
        <h1
          className="text-3xl mb-1"
          style={{ color: C.ink, fontFamily: 'Georgia, serif' }}
        >
          Go Doc
        </h1>
        <p className="text-sm mb-6" style={{ color: '#5b6a6e' }}>
          Sign in to continue
        </p>

        {!hasSupabaseConfig && (
          <div className="mb-4 text-xs p-3 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>
            Supabase env vars not set. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to <code>.env.local</code>.
          </div>
        )}

        <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: C.ink }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-lg mb-4 outline-none"
          style={{ background: 'white', border: `1px solid ${C.tealSoft}` }}
        />

        <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: C.ink }}>Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-lg mb-4 outline-none"
          style={{ background: 'white', border: `1px solid ${C.tealSoft}` }}
        />

        {err && <div className="text-xs mb-3" style={{ color: '#b91c1c' }}>{err}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg font-bold text-sm"
          style={{ background: C.teal, color: C.ink, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-[11px] mt-4 text-center" style={{ color: '#7b8a8e' }}>
          Admin creates new doctor accounts from the Doctors tab.
        </p>
      </form>
    </div>
  )
}
