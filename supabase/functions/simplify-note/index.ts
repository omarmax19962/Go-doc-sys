// supabase/functions/simplify-note/index.ts
// Edge function: rewrite a clinical SOAP session note into plain, warm,
// patient-friendly language in English AND Arabic.
//
// Uses Google Gemini's FREE tier when a key is configured. The key is read
// server-side only (never shipped to the browser):
//   - from Supabase Function secret  GEMINI_API_KEY, or
//   - from the app_secrets table     key = 'gemini_api_key'
//
// If no key is set, the function returns 200 with { en:"", ar:"", skipped:true }
// so the frontend silently falls back to its built-in local simplifier.
//
// Caller must be an authenticated admin or doctor.
//
// Deploy: supabase functions deploy simplify-note

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // ---- auth: must be a signed-in admin or doctor ----
    const authHeader = req.headers.get("Authorization") || ""
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } })
    const { data: u } = await userClient.auth.getUser()
    if (!u?.user) return json({ error: "not authenticated" }, 401)
    const { data: prof } = await userClient.from("profiles").select("role").eq("id", u.user.id).maybeSingle()
    if (prof?.role !== "admin" && prof?.role !== "doctor") return json({ error: "not allowed" }, 403)

    const note = await req.json().catch(() => ({}))

    // ---- find a Gemini key (function secret, else app_secrets) ----
    let apiKey = Deno.env.get("GEMINI_API_KEY") || ""
    if (!apiKey) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
      const { data } = await admin.from("app_secrets").select("value").eq("key", "gemini_api_key").maybeSingle()
      apiKey = data?.value || ""
    }
    if (!apiKey) return json({ en: "", ar: "", skipped: true, reason: "no_key" })

    const clinical = [
      note.type ? `Session type: ${note.type}` : "",
      (note.painBefore != null && note.painBefore !== "") ? `Pain before: ${note.painBefore}/10` : "",
      (note.painAfter != null && note.painAfter !== "") ? `Pain after: ${note.painAfter}/10` : "",
      note.response ? `Response: ${note.response}` : "",
      note.subjective ? `Subjective: ${note.subjective}` : "",
      note.objective ? `Objective: ${note.objective}` : "",
      note.assessment ? `Assessment: ${note.assessment}` : "",
      note.goals ? `Goals: ${note.goals}` : "",
      (note.exercises && note.exercises.length) ? `Exercises: ${note.exercises.join(", ")}` : "",
      (note.modalities && note.modalities.length) ? `Modalities: ${note.modalities.join(", ")}` : "",
      note.hep ? `Home exercise plan: ${note.hep}` : "",
      note.education ? `Patient education: ${note.education}` : "",
      note.plan ? `Plan: ${note.plan}` : "",
      note.additionalNotes ? `Notes: ${note.additionalNotes}` : "",
    ].filter(Boolean).join("\n")

    const prompt =
`You are helping a physiotherapy clinic explain a session to the PATIENT (a non-medical person).
Rewrite the clinical note below into a short, warm, encouraging summary the patient can understand.
Rules:
- 2 to 4 short sentences. No medical jargon, no abbreviations.
- Speak directly to the patient ("you"). Be positive but honest.
- Mention pain change and what was worked on if present. Include any home exercises plainly.
- Do NOT invent facts that aren't in the note.
Return ONLY strict JSON: {"en":"<English summary>","ar":"<Arabic (Egyptian-friendly) summary>"}

Clinical note:
${clinical}`

    const model = "gemini-2.0-flash"
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      return json({ en: "", ar: "", skipped: true, reason: "api_error", detail: t.slice(0, 300) })
    }
    const out = await resp.json()
    const text = out?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    let parsed: { en?: string; ar?: string } = {}
    try { parsed = JSON.parse(text) } catch {
      const m = text.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch { /* ignore */ } }
    }
    return json({ en: (parsed.en || "").trim(), ar: (parsed.ar || "").trim() })
  } catch (e) {
    return json({ en: "", ar: "", skipped: true, reason: "exception", detail: String(e).slice(0, 200) })
  }
})
