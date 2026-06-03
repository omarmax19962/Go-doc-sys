// supabase/functions/invite-doctor/index.ts
// Edge function: admin-only doctor invite.
// Calls Supabase admin API with the service-role key to send a magic-link
// invite email and create the profile row with role=doctor.
//
// Deploy with: supabase functions deploy invite-doctor --no-verify-jwt
// (or with JWT verification on, but then the caller's bearer token must be valid
// and the function will additionally check the caller is admin)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { email, full_name, doctor_id } = await req.json()
    if (!email) return json({ error: "email required" }, 400)

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!

    // Check caller is admin
    const authHeader = req.headers.get("Authorization") || ""
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: u } = await userClient.auth.getUser()
    if (!u?.user) return json({ error: "not authenticated" }, 401)
    const { data: prof } = await userClient.from("profiles").select("role").eq("id", u.user.id).maybeSingle()
    if (prof?.role !== "admin") return json({ error: "admin only" }, 403)

    // Send invite
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: invite, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role: "doctor", doctor_id },
    })
    if (error) return json({ error: error.message }, 400)

    // Ensure profile row has role=doctor and is linked to doctor_id
    if (invite?.user?.id) {
      await admin.from("profiles").upsert({
        id: invite.user.id,
        email,
        full_name,
        role: "doctor",
        doctor_id: doctor_id || null,
      })
      if (doctor_id) {
        await admin.from("doctors").update({ user_id: invite.user.id }).eq("id", doctor_id)
      }
    }

    return json({ ok: true, user_id: invite?.user?.id })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  })
}
