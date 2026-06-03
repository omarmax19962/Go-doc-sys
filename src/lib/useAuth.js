import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

/**
 * useAuth — subscribes to Supabase auth state, then loads the user's
 * profile row (role, full_name, doctor_id).
 *
 * Returns:
 *   { user, profile, role, loading, signIn, signOut, refreshProfile }
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    if (error) console.error('[useAuth] profile load', error)
    setProfile(data || null)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const u = data?.session?.user || null
      setUser(u)
      loadProfile(u?.id).finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user || null
      setUser(u)
      loadProfile(u?.id)
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const signIn = useCallback(async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null); setUser(null)
  }, [])

  const refreshProfile = useCallback(() => loadProfile(user?.id), [loadProfile, user?.id])

  return {
    user,
    profile,
    role: profile?.role || null,
    loading,
    signIn,
    signOut,
    refreshProfile,
  }
}
