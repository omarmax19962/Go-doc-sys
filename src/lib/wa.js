/**
 * wa.js — WhatsApp "click-to-chat" deep links (no Business API needed).
 *
 * Builds https://wa.me/<intl-number>?text=<message> URLs. Opening one launches
 * WhatsApp (app on mobile, Web on desktop) with the number selected and the
 * message pre-typed — a human just presses send. Free, official, no approval.
 */

// Normalise a locally-typed phone to a digits-only international number.
// Default country code is Egypt (20). Handles spaces/dashes/parens, a leading
// trunk "0", an international "00" prefix, and already-international "+" / cc.
export const waPhone = (phone, cc = '20') => {
  if (!phone) return ''
  let s = String(phone).trim()
  const intl = s.startsWith('+')
  s = s.replace(/\D/g, '')
  if (!s) return ''
  if (intl) return s                       // already +<cc>...
  if (s.startsWith('00')) return s.slice(2) // 00<cc>... → <cc>...
  if (s.startsWith('0')) s = s.slice(1)     // drop trunk 0
  if (s.startsWith(cc)) return s            // already prefixed with cc
  return cc + s
}

// Full wa.me link with an optional pre-filled message.
export const waLink = (phone, text = '', cc = '20') => {
  const num = waPhone(phone, cc)
  if (!num) return ''
  return `https://wa.me/${num}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

// Open WhatsApp for a phone + message. Call this synchronously inside a click
// handler (before any await) so the browser keeps the user-gesture and doesn't
// block the pop-up. Returns true if a link was opened.
export const openWhatsApp = (phone, text = '', cc = '20') => {
  const url = waLink(phone, text, cc)
  if (!url || typeof window === 'undefined') return false
  window.open(url, '_blank')
  return true
}
