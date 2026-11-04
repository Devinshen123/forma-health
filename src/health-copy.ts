import type { HealthConnection } from './health';

/**
 * Bilingual, side-effect-free copy for the health connections UI and the OAuth
 * callback result page. Kept separate from the component so every state can be
 * tested without a browser, and so server-sent error codes map to actionable text
 * instead of a generic failure.
 */
type Pair = readonly [zh: string, en: string];
const pick = (pair: Pair, zh: boolean) => pair[zh ? 0 : 1];

export type HealthViewState = 'demo' | 'loading' | 'unavailable' | HealthConnection['status'];

export function healthViewState(connection: HealthConnection | undefined, options: { demo: boolean; loading: boolean }): HealthViewState {
  if (options.demo) return 'demo';
  if (connection) return connection.status;
  return options.loading ? 'loading' : 'unavailable';
}

const statusCopy: Record<HealthViewState, Pair> = {
  demo: ['登录后查看连接', 'Sign in to view connections'],
  loading: ['正在读取…', 'Loading…'],
  unavailable: ['状态暂不可用', 'Status unavailable'],
  not_configured: ['服务器未配置', 'Not configured on this server'],
  disconnected: ['未连接', 'Not connected'],
  connected: ['已连接', 'Connected'],
  reauthorize: ['需要重新授权', 'Authorization required'],
  needs_iphone: ['需要 iPhone 授权', 'Requires iPhone authorization'],
};
export const healthStatusText = (state: HealthViewState, zh: boolean) => pick(statusCopy[state], zh);

/** Extra guidance shown under the status badge, or null when the badge is enough. */
export function healthStateHint(state: HealthViewState, connection: HealthConnection | undefined, zh: boolean): string | null {
  switch (state) {
    case 'not_configured':
      return pick(['此服务器尚未配置该平台的开发者应用凭证，因此无法连接。这不是你的账户问题；需要网站所有者完成平台注册并在服务端配置后才可使用。', 'This server has no developer app credentials for this provider, so connecting is unavailable. This is not a problem with your account; the site owner must register with the provider and configure the server first.'], zh);
    case 'reauthorize':
      return pick(['授权已失效或被撤销，同步已暂停。请重新授权以继续。已导入的记录仍保留。', 'Authorization expired or was revoked and sync is paused. Authorize again to continue. Imported records are retained.'], zh);
    case 'unavailable':
      return pick(['无法读取连接状态。请刷新后重试。', 'Connection status could not be loaded. Refresh and try again.'], zh);
    case 'connected':
      return connection && connection.recordCount === 0 && !connection.lastError
        ? pick(['已连接，暂无导入记录。点击“立即同步”读取最近 7 天的数据。', 'Connected with no imported records yet. Use “Sync now” to read the most recent 7 days.'], zh)
        : null;
    case 'needs_iphone':
      return connection && connection.recordCount === 0
        ? pick(['尚未从 iPhone 上传任何记录。网页无法直接读取 Apple Health。', 'No records have been uploaded from an iPhone yet. The website cannot read Apple Health directly.'], zh)
        : null;
    default:
      return null;
  }
}

const lastErrorCopy: Record<string, Pair> = {
  HEALTH_REAUTHORIZE: ['上次同步因授权失效而停止，请重新授权。', 'The last sync stopped because authorization expired. Authorize again.'],
  HEALTH_PERMISSION_REQUIRED: ['上次同步缺少所需的读取权限，请重新授权并允许相应数据类型。', 'The last sync lacked a required read permission. Authorize again and allow the needed data types.'],
  HEALTH_MISSING_SCOPES: ['授权时未允许任何可读取的数据类型，请重新授权。', 'No readable data types were allowed during authorization. Authorize again.'],
  HEALTH_PROVIDER_RATE_LIMIT: ['平台暂时限制了请求频率，请稍后再同步。', 'The provider is rate limiting requests. Sync again later.'],
  HEALTH_PROVIDER_UNAVAILABLE: ['平台服务暂时不可用，请稍后再同步。', 'The provider service was unavailable. Sync again later.'],
  HEALTH_TIMEOUT: ['上次同步超时，请稍后重试。', 'The last sync timed out. Try again later.'],
  HEALTH_INVALID_RESPONSE: ['平台返回了无法识别的数据，未保存任何部分结果。', 'The provider returned data that could not be read; no partial results were saved.'],
  HEALTH_RESPONSE_LIMIT: ['平台返回的数据超过安全上限，未保存任何部分结果。', 'The provider response exceeded the safety limit; no partial results were saved.'],
  HEALTH_CONNECTION_CHANGED: ['同步期间连接已变化，结果已丢弃。', 'The connection changed during sync, so results were discarded.'],
};
export function healthLastErrorText(code: string | null, zh: boolean): string | null {
  if (!code) return null;
  return pick(lastErrorCopy[code] ?? ['上次同步未完成，请检查授权和连接后重试。', 'The last sync did not finish. Check authorization and try again.'], zh);
}

const actionErrorCopy: Record<string, Pair> = {
  HEALTH_NOT_CONFIGURED: ['此平台尚未在服务器上配置，无法连接或同步。', 'This provider is not configured on the server, so it cannot connect or sync.'],
  HEALTH_SYNC_BUSY: ['此连接正在同步，请等待完成后再试。', 'This connection is already syncing. Wait for it to finish.'],
  HEALTH_CONNECTION_CHANGED: ['连接状态已变化，请刷新后重试。', 'The connection changed. Refresh and try again.'],
  HEALTH_REAUTHORIZE: ['授权已失效，请重新授权。', 'Authorization expired. Authorize again.'],
  HEALTH_PERMISSION_REQUIRED: ['缺少所需的读取权限，请重新授权。', 'A required read permission is missing. Authorize again.'],
  HEALTH_PROVIDER_RATE_LIMIT: ['平台暂时限制了请求频率，请稍后再试。', 'The provider is rate limiting requests. Try again later.'],
  HEALTH_PROVIDER_UNAVAILABLE: ['平台服务暂时不可用，请稍后再试。', 'The provider service is unavailable. Try again later.'],
  HEALTH_TIMEOUT: ['请求超时，请稍后再试。', 'The request timed out. Try again later.'],
};
/** Maps an API failure (status + optional server code) to user-facing text. */
export function healthActionErrorText(status: number | undefined, code: string | undefined, zh: boolean): string {
  if (code && actionErrorCopy[code]) return pick(actionErrorCopy[code], zh);
  if (status === 401) return pick(['账户已变化或登录失效，请重新登录。', 'Your account changed or session expired. Sign in again.'], zh);
  if (status === 429) return pick(['请求过于频繁，请稍后重试。', 'Requests are too frequent. Try again shortly.'], zh);
  if (status === 503) return pick(actionErrorCopy.HEALTH_NOT_CONFIGURED, zh);
  return pick(['暂时无法完成操作。请刷新连接状态后重试。', 'The request could not finish. Refresh connection status and try again.'], zh);
}

export type CallbackOutcome = 'connected' | 'denied' | 'not_configured' | 'not_linked' | 'missing_scopes' | 'expired';
export function callbackOutcome(code: string | undefined): Exclude<CallbackOutcome, 'connected'> {
  if (code === 'HEALTH_CONSENT_DENIED') return 'denied';
  if (code === 'HEALTH_NOT_CONFIGURED') return 'not_configured';
  if (code === 'HEALTH_ACCOUNT_NOT_LINKED') return 'not_linked';
  if (code === 'HEALTH_MISSING_SCOPES') return 'missing_scopes';
  return 'expired';
}
const callbackCopy: Record<CallbackOutcome, { title: Pair; body: Pair }> = {
  connected: { title: ['健康账户已连接', 'Health account connected'], body: ['返回 Forma 设置页同步并查看导入记录。', 'Return to Forma settings to sync and review imported records.'] },
  denied: { title: ['未完成连接', 'Connection incomplete'], body: ['你在授权页面拒绝了访问，未保存任何连接。可以随时在 Forma 设置中重新连接。', 'Access was declined on the authorization page and no connection was saved. You can connect again from Forma settings at any time.'] },
  not_configured: { title: ['此平台尚未配置', 'Provider not configured'], body: ['此服务器尚未配置该平台的开发者应用凭证，未建立连接。', 'This server has no developer app credentials for this provider, so no connection was made.'] },
  not_linked: { title: ['未完成连接', 'Connection incomplete'], body: ['该 Google 账户尚未建立 Google Health 档案，未建立连接。', 'This Google account has no Google Health profile yet, so no connection was made.'] },
  missing_scopes: { title: ['未完成连接', 'Connection incomplete'], body: ['授权时未允许任何可读取的数据类型，未建立连接。', 'No readable data types were allowed, so no connection was made.'] },
  expired: { title: ['未完成连接', 'Connection incomplete'], body: ['授权已过期或无法验证。请返回 Forma 重新开始连接。', 'The authorization expired or could not be verified. Return to Forma and start a new connection.'] },
};
/** Static bilingual page; contains no tokens, codes, provider error text or user data. */
export function callbackPage(outcome: CallbackOutcome): string {
  const copy = callbackCopy[outcome];
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + `<title>Forma · ${copy.title[1]}</title>`
    + `<h1>${copy.title[0]}</h1><p>${copy.body[0]}</p>`
    + `<h1 lang="en">${copy.title[1]}</h1><p lang="en">${copy.body[1]}</p>`
    + '<a href="/">打开 Forma / Open Forma</a></html>';
}
