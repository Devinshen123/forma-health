import {useEffect,useState} from 'react';
import {Cloud,CloudOff,RefreshCw,Download} from 'lucide-react';
import type {Language,SyncCollection} from '../types';
import type {SyncEngine,SyncStatus} from '../sync/engine';
import {entities} from '../sync/changes';
import {Modal} from './Modal';
import ConflictRecord from './ConflictRecord';
export default function SyncPanel({engine,status,lang,expanded=false,onReauthenticate}:{engine:SyncEngine;status:SyncStatus;lang:Language;expanded?:boolean;onReauthenticate:()=>void}) {
  const zh=lang==='zh';const [confirm,setConfirm]=useState<'enable'|'discard'|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false);
  const [showConflict,setShowConflict]=useState(false);
  const conflictKeys=status.conflict?.keys.join('|');
  useEffect(()=>{if(conflictKeys)setShowConflict(true);},[conflictKeys]);
  const perform=async(fn:()=>Promise<void>)=>{if(working)return;setWorking(true);setError('');try{await fn();setConfirm(null);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setWorking(false);}};
  const backup=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(engine.exportPending(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='forma-offline-backup.json';a.click();URL.revokeObjectURL(url);};
  const connected=status.online&&status.connected!==false;
  const summary=zh?(status.conflict?'同步冲突，请审核':status.pending?`${status.pending} 批更改待同步`:status.busy?'正在同步…':connected?'记录已同步':'离线 · 服务暂不可达'):(status.conflict?'Sync conflict: review required':status.pending?`${status.pending} batches pending`:status.busy?'Syncing…':connected?'Records synced':'Offline · Server unavailable');
  return <section className="sync-panel" aria-label={zh?'同步与离线':'Sync and offline'}>
    <div className="sync-line"><span className="sync-summary" role="status">{connected?<Cloud size={18}/>:<CloudOff size={18}/>} {summary}</span><button className="btn btn-ghost" disabled={status.busy||!status.online||!!status.conflict} onClick={()=>void perform(()=>engine.flush())}><RefreshCw size={15}/>{zh?'同步':'Sync'}</button></div>
    {(expanded||status.pending>0||!status.online)&&<>
      <p className="hint">{zh?'同一账户连接同一个服务实例即可合并设备记录。此网站目前运行于本机。':'Devices signed into the same account on the same server can merge records. This website currently runs locally.'}</p>
      <label className="checkbox-label"><input type="checkbox" checked={status.enabled} onChange={e=>e.target.checked?setConfirm('enable'):void perform(()=>engine.enable(false))}/>{zh?'在这台设备上保留离线记录':'Keep offline records on this device'}</label>
      {status.enabled&&<p className="hint">{zh?'断网时保存到这台设备；联网后验证账户并同步。退出或删除账户会清理本设备缓存。':'Saves to this device offline; verifies your account and syncs when connected. Signing out or deleting your account clears this device’s cache.'}</p>}
    </>}
    {(status.error||error)&&<p className="form-error" role="alert">{error||status.error}</p>}
    {status.authRequired&&<button className="btn btn-secondary" onClick={onReauthenticate}>{zh?'重新登录后同步':'Sign in again to sync'}</button>}
    {status.conflict&&<button className="btn btn-secondary" onClick={()=>setShowConflict(true)}>{zh?'审核同步冲突':'Review sync conflict'}</button>}
    {status.pending>0&&<div className="row-actions"><button className="btn btn-secondary" onClick={backup}><Download size={16}/>{zh?'导出本机待同步记录':'Export pending records'}</button>{status.error&&!status.conflict&&<button className="btn btn-ghost" onClick={()=>setConfirm('discard')}>{zh?'放弃本机待同步更改':'Discard pending changes'}</button>}</div>}
    {status.pending>0&&<p className="hint">{zh?'JSON 导出包含记录文字和附件引用，不包含照片或 PDF 文件本体。请另外保留原文件。':'JSON exports include record text and attachment references, but no photo or PDF file bytes. Keep the original files separately.'}</p>}
    {confirm&&<Modal title={zh?(confirm==='enable'?'在此设备启用离线记录？':'放弃待同步更改？'):(confirm==='enable'?'Enable offline records on this device?':'Discard pending changes?')} onClose={()=>setConfirm(null)} footer={<><button className="btn btn-secondary" onClick={()=>setConfirm(null)}>{zh?'取消':'Cancel'}</button><button className="btn btn-primary" onClick={()=>void perform(()=>confirm==='enable'?engine.enable(true):engine.discardInvalid())}>{zh?'确认':'Confirm'}</button></>}>
      <p>{zh?(confirm==='enable'?'饮食、训练、睡眠及计划文字将存储在当前浏览器的私有数据库中。仅在你信任的设备启用；照片和报告文件不作离线缓存。':'这会移除尚未到达服务端的本机更改。请先导出备份；已同步记录会从服务端重新读取。'):(confirm==='enable'?'Nutrition, training, sleep and plan text will be stored in this browser’s private database. Enable only on a device you trust. Photos and report files are not cached offline.':'Removes local changes that have not reached the server. Export a backup first. Synced records will reload from the server.')}</p>{error&&<p role="alert">{error}</p>}
    </Modal>}
    {status.conflict&&showConflict&&<Modal title={zh?'选择冲突记录':'Choose the conflict version'} description={zh?'不同记录的更改会合并。以下同一条记录两端都发生了变化，需要你决定；历史计划仍受版本校验。':'Changes to separate records merge. These records changed on both devices; choose which version to keep. Plan history remains protected.'} onClose={()=>{if(!working)setShowConflict(false);}} footer={<><button className="btn btn-secondary" onClick={backup}>{zh?'导出备份':'Export backup'}</button><button className="btn btn-secondary" disabled={working} onClick={()=>void perform(()=>engine.resolve(false))}>{zh?'保留服务端冲突记录':'Keep server versions'}</button><button className="btn btn-primary" disabled={working} onClick={()=>void perform(()=>engine.resolve(true))}>{zh?'采用本机冲突记录':'Use local versions'}</button></>}>
      {status.conflict.keys.map(key=>{const split=key.indexOf(':'),collection=key.slice(0,split) as SyncCollection,id=key.slice(split+1);return <ConflictRecord key={key} local={entities(status.conflict!.local,collection).get(id)} remote={entities(status.conflict!.remote,collection).get(id)} lang={lang}/>;})}{error&&<p role="alert" className="form-error">{error}</p>}
    </Modal>}
  </section>;
}
