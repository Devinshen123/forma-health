/* Forma training workbench: the facts this copy of the app is fixed to for its whole life.
 *
 * The outer Forma page opens `/training-workbench/?account=<Forma UUID>&lang=zh|en#/home`. The
 * account is NOT a credential — the server trusts only its HttpOnly session cookie — it is the
 * account this iframe was opened for. Every private request says it (X-Forma-Account) so the
 * server refuses a request whose cookie now belongs to somebody else, and every piece of browser
 * storage this app touches lives under it (bootstrap.js). Read once, at module load: a later
 * change of the address never moves this page to another account.
 *
 * Plain module, no storage, no React: bootstrap.js imports it before anything else runs.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const params = (() => {
  try { return new URLSearchParams(globalThis.location?.search || '') } catch { return new URLSearchParams() }
})()

const rawAccount = params.get('account')

/** The Forma account id this page is bound to, or null when it was not opened from Forma. */
export const ACCOUNT = typeof rawAccount === 'string' && UUID.test(rawAccount) ? rawAccount : null

/** The UI language Forma asked for. Only Forma's two languages; anything else is Chinese. */
export const LANG = params.get('lang') === 'en' ? 'en' : 'zh'

/** The prefix of every storage key, database, cache and channel name this page uses. */
export const PREFIX = ACCOUNT ? `forma-workbench:${ACCOUNT}:` : null

/** The private API under this page (`/training-workbench/api/...` through lib/app-base.js). */
export const ACCOUNT_HEADER = 'X-Forma-Account'

/** A sentence written for the workbench itself, in Forma's language. */
export const fw = (zh, en) => (LANG === 'en' ? en : zh)

/* The session this page was opened with is gone (401) or no longer this account's (403, or a
   /me that names someone else). Said once; the app then shows a full-screen notice that sends
   the person back to Forma, and never falls back to a guest copy or another account. */
let lost = null
const listeners = new Set()
export function notifyAuthLost(status) {
  if (lost) return
  lost = { status: Number(status) || 0 }
  for (const fn of listeners) { try { fn() } catch { /* a listener's own problem */ } }
}
export const authLost = () => lost
export function subscribeAuthLost(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
