import { fw } from './context.js'

/* The only "sign-in" screen of the Forma training workbench. Accounts live in Forma: this page
   never offers a password, a passkey, a guest mode or another server. It shows when the session
   this page was opened with has ended or now belongs to a different Forma account (`lost`, a
   401/403), or when the server could not confirm who is signed in at all. Whatever this browser
   kept for the account stays under that account's own storage and is sent the next time the
   workbench is opened for it. */
export default function FormaGate({ lost }) {
  const refused = lost && lost.status === 403
  const title = lost
    ? (refused ? fw('Forma 账户已变化', 'Your Forma account changed') : fw('Forma 登录已失效', 'Your Forma sign-in has ended'))
    : fw('暂时无法连接训练工作台', 'The training workbench can’t be reached right now')
  const text = lost
    ? fw('请回到 Forma 重新登录，然后从训练页重新打开训练工作台。本机尚未同步的训练记录会保留在该账户下。',
      'Go back to Forma, sign in again, and reopen the workbench from the Training page. Anything not yet synced stays saved for this account on this device.')
    : fw('无法确认 Forma 登录状态。请检查网络后重试，或回到 Forma 重新打开训练页。',
      'Your Forma sign-in could not be confirmed. Check your connection and try again, or reopen the Training page in Forma.')
  const openForma = () => {
    // Inside Forma's iframe the outer page is Forma itself; opened on its own, go to Forma.
    try { if (window.top && window.top !== window) { window.top.location.assign('/'); return } } catch { /* not reachable from here */ }
    window.location.assign('/')
  }
  return <div id="app" className="forma-gate" role="alert">
    <div className="forma-gate-card">
      <div className="forma-gate-brand">Forma</div>
      <h1>{title}</h1>
      <p>{text}</p>
      <div className="forma-gate-actions">
        <button type="button" className="forma-gate-btn primary" onClick={openForma}>{fw('回到 Forma', 'Back to Forma')}</button>
        {!lost && <button type="button" className="forma-gate-btn" onClick={() => window.location.reload()}>{fw('重试', 'Try again')}</button>}
      </div>
    </div>
  </div>
}
