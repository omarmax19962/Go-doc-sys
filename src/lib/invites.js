import { supabase } from './supabase'

/**
 * Invite a doctor by email. Requires the `invite-doctor` Edge Function to be
 * deployed. Falls back gracefully with a console message if not.
 */
export async function inviteDoctor({ email, full_name, doctor_id }) {
  const { data, error } = await supabase.functions.invoke('invite-doctor', {
    body: { email, full_name, doctor_id },
  })
  if (error) {
    console.error('inviteDoctor', error)
    return { ok: false, error: error.message || String(error) }
  }
  return data || { ok: true }
}
