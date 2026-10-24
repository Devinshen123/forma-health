import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Link2, RefreshCw, Trash2, Unplug, Watch } from 'lucide-react';
import { ApiError, request } from '../api';
import type { Language } from '../types';
import { HEALTH_PROVIDERS, type HealthConnection, type HealthConnectionsResponse, type HealthKind, type HealthProvider, type HealthRecordsResponse, type HealthSyncResponse, type ImportedHealthRecord } from '../health';
import { Modal } from '../components/Modal';

const names: Record<HealthProvider, string> = { whoop: 'WHOOP', oura: 'Oura Ring', 'google-health': 'Google Health', 'apple-health': 'Apple Health / Apple Watch' };
const applications: Record<HealthProvider, string> = {
  whoop: 'https://developer-dashboard.whoop.com/', oura: 'https://developer.ouraring.com/',
  'google-health': 'https://console.cloud.google.com/', 'apple-health': 'https://developer.apple.com/account/',
};
const labels: Record<HealthKind, [string, string]> = {
  steps: ['步数', 'Steps'], active_energy: ['活动能量', 'Active energy'], total_energy: ['总能量', 'Total energy'],
  heart_rate: ['心率', 'Heart rate'], resting_heart_rate: ['静息心率', 'Resting heart rate'],
  hrv_rmssd: ['HRV（RMSSD）', 'HRV (RMSSD)'], hrv_sdnn: ['HRV（SDNN）', 'HRV (SDNN)'],
  sleep: ['睡眠', 'Sleep'], workout: ['运动', 'Workout'], recovery: ['WHOOP 恢复', 'WHOOP recovery'],
  readiness: ['Oura 准备度', 'Oura readiness'], weight: ['体重', 'Weight'], oxygen_saturation: ['血氧', 'Oxygen saturation'],
};
function statusText(connection: HealthConnection | undefined, zh: boolean, demo: boolean) {
  if (demo) return zh ? '登录后查看连接' : 'Sign in to view connections';
  if (!connection) return '—';
  const texts: Record<HealthConnection['status'], [string, string]> = {
    not_configured: ['待配置开发者应用', 'Developer app not configured'], disconnected: ['未连接', 'Not connected'],
    connected: ['已连接', 'Connected'], reauthorize: ['需要重新授权', 'Authorization required'], needs_iphone: ['需要 iPhone 授权', 'Requires iPhone authorization'],
  };
  return texts[connection.status]?.[zh ? 0 : 1] ?? '—';
}
function healthError(error: unknown, zh: boolean) {
  if (error instanceof ApiError) {
    if (error.status === 401) return zh ? '账户已变化或登录失效，请重新登录。' : 'Your account changed or session expired. Sign in again.';
    if (error.status === 429) return zh ? '正在同步或请求过于频繁，请稍后重试。' : 'Sync is running or requests are too frequent. Try again shortly.';
    if (error.status === 503) return zh ? '连接尚未配置完成，请先完成开发者应用与服务端设置。' : 'Complete developer registration and server configuration first.';
  }
  return zh ? '暂时无法完成操作。请刷新连接状态后重试。' : 'The request could not finish. Refresh connection status and try again.';
}

export default function HealthConnections({ lang, demo, accountId, onCreate }: { lang: Language; demo: boolean; accountId?: string; onCreate: () => void }) {
  const zh = lang === 'zh';
  const [connections, setConnections] = useState<HealthConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<HealthProvider | 'refresh' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<HealthProvider | null>(null);
  const [records, setRecords] = useState<ImportedHealthRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ provider: HealthProvider; action: 'disconnect' | 'delete' } | null>(null);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const activeRequest = useRef(false);
  const readEpoch = useRef(0);
  const headers = { 'X-Forma-Account': accountId ?? '' };

  async function refresh(signal?: AbortSignal, ticket = epoch.current) {
    if (demo || !accountId) return;
    const data = await request<HealthConnectionsResponse>('/health/connections', { headers, signal });
    if (ticket === epoch.current && !signal?.aborted) setConnections(data.connections);
  }
  useEffect(() => {
    const ticket = ++epoch.current;
    const abort = new AbortController(); controller.current = abort;
    activeRequest.current = false;
    setConnections([]); setRecords([]); setSelected(null); setCursor(null); setBusy(null); setError(''); setNotice(''); setConfirm(null);
    if (!demo && accountId) {
      setLoading(true);
      void refresh(abort.signal, ticket).catch((failure) => {
        if (ticket === epoch.current && !abort.signal.aborted) setError(healthError(failure, zh));
      }).finally(() => { if (ticket === epoch.current) setLoading(false); });
    } else setLoading(false);
    return () => { ++epoch.current; ++readEpoch.current; abort.abort(); };
  }, [accountId, demo]);

  async function action(provider: HealthProvider | 'refresh', kind: 'refresh' | 'connect' | 'sync' | 'disconnect' | 'delete') {
    if (!accountId || demo || activeRequest.current) return;
    activeRequest.current = true;
    const ticket = epoch.current;
    setBusy(provider); setError(''); setNotice('');
    try {
      const init = { headers, signal: controller.current?.signal };
      if (kind === 'refresh') await refresh(init.signal, ticket);
      else if (kind === 'connect') {
        const data = await request<{ authorizationUrl: string }>(`/health/${provider}/connect`, { ...init, method: 'POST', body: '{}' });
        if (ticket !== epoch.current) return;
        const url = new URL(data.authorizationUrl);
        const hosts = provider === 'whoop' ? ['api.prod.whoop.com'] : provider === 'oura' ? ['cloud.ouraring.com', 'developer.ouraring.com'] : ['accounts.google.com'];
        if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password) throw new Error('Unexpected authorization destination');
        window.location.assign(url.href);
      } else if (kind === 'sync') {
        const result = await request<HealthSyncResponse>(`/health/${provider}/sync`, { ...init, method: 'POST', body: '{}' });
        if (ticket !== epoch.current) return;
        setNotice(zh ? `同步完成：${result.imported} 项更新，${result.deleted} 项删除。` : `Sync complete: ${result.imported} updates, ${result.deleted} deletions.`);
        if (selected === provider) { setRecords([]); setCursor(null); setSelected(null); }
        await refresh(init.signal, ticket);
      } else {
        await request(`/health/${provider}/${kind === 'delete' ? 'records' : 'disconnect'}`, { ...init, method: kind === 'delete' ? 'DELETE' : 'POST', body: kind === 'delete' ? '{"confirm":true}' : '{}' });
        if (ticket !== epoch.current) return;
        setConfirm(null);
        setNotice(kind === 'delete' ? (zh ? '此来源的导入记录已删除。' : 'Imported records from this source were deleted.') : (zh ? '已停止此连接的同步；已导入记录仍保留。' : 'Sync stopped. Previously imported records are retained.'));
        if (kind === 'delete' && selected === provider) { setSelected(null); setRecords([]); setCursor(null); }
        await refresh(init.signal, ticket);
      }
    } catch (failure) {
      if (ticket === epoch.current) { setError(healthError(failure, zh)); try { await refresh(controller.current?.signal, ticket); } catch { /* Preserve the actionable error. */ } }
    } finally {
      if (ticket === epoch.current) { activeRequest.current = false; setBusy(null); }
    }
  }
  async function viewRecords(provider: HealthProvider, more = false) {
    if (demo || !accountId || activeRequest.current) return;
    activeRequest.current = true; setBusy(provider); setError('');
    const ticket = epoch.current, readTicket = ++readEpoch.current;
    try {
      const query = new URLSearchParams({ provider, limit: '20' });
      if (more && cursor) query.set('cursor', cursor);
      const result = await request<HealthRecordsResponse>(`/health/records?${query}`, { headers, signal: controller.current?.signal });
      if (ticket !== epoch.current || readTicket !== readEpoch.current) return;
      setSelected(provider); setRecords(previous => more ? [...previous, ...result.records] : result.records); setCursor(result.nextCursor);
    } catch (failure) { if (ticket === epoch.current) setError(healthError(failure, zh)); }
    finally { if (ticket === epoch.current) { activeRequest.current = false; setBusy(null); } }
  }
  const date = (value: string | null) => value ? new Date(value).toLocaleString(zh ? 'zh-CN' : 'en-US') : '—';
  const recordDate = (record: ImportedHealthRecord) => record.metadata.timeBasis === 'provider_local_day' && typeof record.metadata.day === 'string'
    ? `${record.metadata.day} ${zh ? '（设备当地日期）' : '(provider local date)'}` : date(record.startTime);
  const recordLabel = (record: ImportedHealthRecord) => {
    const stages: Record<string, [string, string]> = { in_bed: ['在床区间', 'Time in bed'], awake: ['清醒区间', 'Awake interval'], asleep_unspecified: ['睡眠（阶段未细分）', 'Sleep (unspecified stage)'], asleep_core: ['核心睡眠', 'Core sleep'], asleep_deep: ['深度睡眠', 'Deep sleep'], asleep_rem: ['REM 睡眠', 'REM sleep'], unknown: ['睡眠相关区间（阶段未知）', 'Sleep interval (unknown stage)'] };
    const stage = record.metadata.sleepStage;
    if (record.kind === 'sleep' && typeof stage === 'string') return stages[stage]?.[zh ? 0 : 1] ?? (zh ? '睡眠相关区间' : 'Sleep-related interval');
    if (record.kind === 'heart_rate' && record.metadata.statistic === 'sleep_average') return zh ? '睡眠平均心率' : 'Average sleeping heart rate';
    return labels[record.kind]?.[zh ? 0 : 1] ?? record.kind;
  };
  return <section className="panel health-connections" aria-labelledby="health-connections-title">
    <div className="section-heading"><h2 id="health-connections-title">{zh ? '设备与健康数据' : 'Devices & health data'}</h2><Watch size={22} /></div>
    <p className="muted">{zh ? '连接你的设备账户，保留每条数据的原始来源。导入数据单独保存，不会覆盖手动记录，也不会自动发送给 AI。' : 'Connect your device account and retain each record’s source. Imports are kept separately, preserve manual records and are not automatically sent to AI.'}</p>
    {demo ? <div className="health-notice"><p>{zh ? '演示模式不会连接真实设备。登录后可以查看连接状态和导入记录。' : 'Demo mode does not connect real devices. Sign in to view connections and imported records.'}</p><button className="btn btn-secondary" onClick={onCreate}>{zh ? '登录或创建账户' : 'Sign in or create an account'}</button></div>
      : <button className="btn btn-ghost" disabled={loading || !!busy} onClick={() => void action('refresh', 'refresh')}><RefreshCw size={16} />{loading ? (zh ? '正在读取…' : 'Loading…') : (zh ? '刷新连接状态' : 'Refresh connections')}</button>}
    {error && <p className="health-notice health-error" role="alert">{error}</p>}
    {notice && <p className="health-notice" role="status">{notice}</p>}
    <div className="health-provider-grid">{HEALTH_PROVIDERS.map(provider => {
      const connection = connections.find(item => item.provider === provider);
      const native = provider === 'apple-health';
      return <article className="health-provider" key={provider}>
        <div className="health-provider-heading"><h3>{names[provider]}</h3><span className="badge">{statusText(connection, zh, demo)}</span></div>
        <p className="muted">{native ? (zh ? '在 Forma iPhone App 内授权只读访问，再核对并确认上传。Apple Watch 的数据通过 Apple Health 导入。' : 'Authorize read-only access in the Forma iPhone app, then review and confirm upload. Apple Watch data is imported through Apple Health.') : provider === 'google-health' ? (zh ? '使用 Google Health 云端账户授权。Android Health Connect 是另一条接入通道。' : 'Authorize your Google Health cloud account. Android Health Connect is a separate integration.') : (zh ? '由官方授权页面决定共享范围，可以随时断开连接。' : 'Choose sharing permissions on the official authorization page. You can disconnect at any time.')}</p>
        {!demo && connection && <dl className="health-connection-details"><div><dt>{zh ? '已导入' : 'Imported'}</dt><dd>{connection.recordCount} {zh ? '项' : 'records'}</dd></div><div><dt>{zh ? '上次同步' : 'Last sync'}</dt><dd>{date(connection.lastSyncAt)}</dd></div></dl>}
        {connection?.lastError && <p className="hint" role="status">{zh ? '上次同步未完成，请检查授权和连接后重试。' : 'The last sync did not finish. Check authorization and try again.'}</p>}
        <div className="health-actions">
          {!native && <button className="btn btn-primary" disabled={demo || loading || !!busy || !connection?.configured || connection.status === 'connected'} onClick={() => void action(provider, 'connect')}><Link2 size={16} />{connection?.status === 'reauthorize' ? (zh ? '重新授权' : 'Authorize again') : (zh ? '连接账户' : 'Connect account')}</button>}
          {connection?.status === 'connected' && !native && <button className="btn btn-secondary" disabled={!!busy} onClick={() => void action(provider, 'sync')}><RefreshCw size={16} />{busy === provider ? (zh ? '正在处理…' : 'Working…') : (zh ? '立即同步' : 'Sync now')}</button>}
          {connection?.status === 'connected' && <button className="btn btn-ghost" disabled={!!busy} onClick={() => setConfirm({ provider, action: 'disconnect' })}><Unplug size={16} />{zh ? '断开' : 'Disconnect'}</button>}
          {!!connection?.recordCount && <button className="btn btn-ghost" disabled={!!busy} onClick={() => void viewRecords(provider)}>{zh ? '查看导入记录' : 'View imported records'}</button>}
        </div>
        {!!connection?.recordCount && <button className="btn btn-ghost health-delete" disabled={!!busy} onClick={() => setConfirm({ provider, action: 'delete' })}><Trash2 size={14} />{zh ? '删除此来源导入记录' : 'Delete imports from this source'}</button>}
        {!native && <details className="health-setup"><summary>{zh ? '开发者配置' : 'Developer setup'}</summary>
          <p className="hint">{zh ? '先注册应用并在服务端配置凭证。正式使用需要平台接受的 HTTPS 回调地址；下面的本机地址不代表平台已批准。' : 'Register an app and configure credentials on the server. Production requires an accepted HTTPS callback; a local address does not imply provider approval.'}</p>
          <p className="health-callback"><strong>{zh ? '授权回调' : 'OAuth callback'}</strong><code>{connection?.callbackUrl ?? `/integrations/${provider}/callback`}</code></p>
          <a className="btn btn-ghost" href={applications[provider]} target="_blank" rel="noreferrer">{zh ? '打开官方申请页面' : 'Open developer registration'}<ArrowUpRight size={15} /></a>
        </details>}
      </article>;
    })}</div>
    <p className="hint">{zh ? '云端按最近时间窗口同步，不保证实时更新或完整历史。不同来源的步数、能量和睡眠不会简单相加；HRV 的 RMSSD 与 SDNN 分别保留。设备原生的恢复或准备度数值不等于 Forma 健康评分。' : 'Cloud sync uses a recent time window and does not guarantee realtime or full history. Steps, energy and sleep from different sources are not simply added; RMSSD and SDNN remain distinct. Device recovery/readiness values are not a Forma health score.'}</p>
    {selected && <div className="health-import-preview"><div className="section-heading"><h3>{names[selected]} · {zh ? '导入记录' : 'Imported records'}</h3><button className="btn btn-ghost" disabled={!!busy} onClick={() => { setSelected(null); setRecords([]); setCursor(null); }}>{zh ? '收起' : 'Close'}</button></div>
      <div className="health-table-wrap"><table className="health-table"><caption>{zh ? '保留原始来源，数值不跨来源合计' : 'Original sources retained; values are not summed across sources'}</caption><thead><tr><th>{zh ? '类型' : 'Type'}</th><th>{zh ? '数值' : 'Value'}</th><th>{zh ? '时间' : 'Time'}</th><th>{zh ? '来源' : 'Source'}</th></tr></thead><tbody>{records.map(record => <tr key={`${record.provider}:${record.kind}:${record.id}`}><td>{recordLabel(record)}</td><td>{record.value === null ? '—' : `${new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US', { maximumFractionDigits: 2 }).format(record.value)} ${record.unit}`}</td><td>{recordDate(record)}</td><td>{record.source.sourceName}</td></tr>)}</tbody></table></div>
      {!records.length && <p>{zh ? '此来源暂时没有导入记录。' : 'No imported records from this source.'}</p>}
      {cursor && <button className="btn btn-secondary" disabled={!!busy} onClick={() => void viewRecords(selected, true)}>{zh ? '加载更多' : 'Load more'}</button>}
    </div>}
    {confirm && <Modal title={confirm.action === 'delete' ? (zh ? '删除导入记录？' : 'Delete imported records?') : (zh ? '断开数据连接？' : 'Disconnect this source?')} onClose={() => { if (!busy) setConfirm(null); }}>
      <p>{confirm.action === 'delete' ? (zh ? `将永久删除 ${names[confirm.provider]} 的导入记录，不影响手动填写的记录。保持连接时，后续同步可能再次导入。` : `Permanently delete imports from ${names[confirm.provider]}. Manual records are retained. Future sync may import them again if still connected.`) : (zh ? '停止后续同步并移除本机保存的连接凭证。已导入记录保留；你也可以在设备平台的设置里撤销授权。' : 'Stop future sync and remove locally stored connection credentials. Imported history is retained. You can also revoke access in the provider settings.')}</p>
      <div className="health-actions"><button className="btn btn-secondary" disabled={!!busy} onClick={() => setConfirm(null)}>{zh ? '取消' : 'Cancel'}</button><button className="btn btn-primary" disabled={!!busy} onClick={() => void action(confirm.provider, confirm.action)}>{busy ? (zh ? '正在处理…' : 'Working…') : confirm.action === 'delete' ? (zh ? '永久删除导入记录' : 'Permanently delete imports') : (zh ? '确认断开' : 'Disconnect')}</button></div>
    </Modal>}
  </section>;
}
