/* dispatch.js — one tick of the alert engine: derive → create/resolve → ping → escalate.
 * All I/O goes through injected `store` and `push`, so the whole run loop is unit-tested
 * (dispatch.test.js) with in-memory fakes; alert-dispatch/index.ts only wires the real
 * Supabase + web-push implementations in.
 *
 * store: loadContext(now) createAlerts(rows) resolveAlerts([{dedupe_key,reason}])
 *        dueAlerts(now) claim(alert, patch)->bool update(id, patch) subscriptions(role, identity)
 *        removeSubscription(id) notifyAdmin(text)
 * push:  send(sub, payload, {ttl, urgency}) -> {ok:boolean, gone:boolean} */
import { deriveAlerts, planDispatch, buildPayload, escalationText } from "./alertRules.js";

const iso = (ms) => new Date(ms).toISOString();

export async function runDispatch({ now, store, push, ackUrlFor }) {
  const out = { created: 0, resolved: 0, sent: 0, deferred: 0, expired: 0, escalated: 0, deadSubs: 0, errors: [] };

  const ctx = await store.loadContext(now);
  const { create, resolve } = deriveAlerts({ now, ...ctx });
  if (create.length) { await store.createAlerts(create); out.created = create.length; }
  if (resolve.length) { await store.resolveAlerts(resolve); out.resolved = resolve.length; }

  const escalate = async (a, extra = "") => {
    await store.notifyAdmin(escalationText(a) + extra);
    await store.update(a.id, { escalated_at: iso(now) });
    out.escalated++;
  };

  for (const a of await store.dueAlerts(now)) {
    try {
      const plan = planDispatch(a, now);
      if (plan.action === "skip") continue;

      if (plan.action === "defer") {
        if (await store.claim(a, { next_attempt_at: iso(plan.until) })) out.deferred++;
        continue;
      }
      if (plan.action === "expire") {
        await store.update(a.id, { status: "expired", resolved_at: iso(now), resolved_reason: plan.reason });
        if (!a.escalated_at && a.kind !== "session_soon") await escalate({ ...a, attempts: a.attempts - 1 }, " It has now expired.");
        out.expired++;
        continue;
      }

      // send: claim this attempt first so an overlapping run can't double-ping
      const patch = { attempts: plan.attempt, last_sent_at: iso(now), next_attempt_at: iso(plan.nextAt ?? now) };
      if (plan.last) Object.assign(patch, { status: "expired", resolved_at: iso(now), resolved_reason: "exhausted" });
      if (!(await store.claim(a, patch))) continue;

      const subs = await store.subscriptions("doctor", a.doctor_name);
      const payload = buildPayload(a, plan.attempt, now, await ackUrlFor(a.id));
      const deadline = a.deadline_at ? Date.parse(a.deadline_at) : null;
      const opts = { urgency: payload.urgency, ttl: Math.max(60, Math.min(3600, deadline ? Math.round((deadline - now) / 1000) : 3600)) };
      let delivered = 0;
      for (const s of subs) {
        const r = await push.send(s, payload, opts);
        if (r.ok) delivered++;
        else if (r.gone) { await store.removeSubscription(s.id); out.deadSubs++; }
      }
      out.sent++;
      if (plan.escalate) await escalate({ ...a, attempts: plan.attempt - 1 });
      else if (delivered === 0 && plan.attempt === 1 && a.severity === "critical" && !a.escalated_at) {
        // a critical alert and no device to reach: don't wait for the ladder, tell the admin now
        await store.notifyAdmin(`⚠ ${a.doctor_name} has no working device alerts, so a critical request can't reach them. Call them.`);
        await store.update(a.id, { escalated_at: iso(now) });
        out.escalated++;
      }
    } catch (e) { out.errors.push(`alert ${a.id}: ${e.message || e}`); }
  }
  return out;
}
