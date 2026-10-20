import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Gift, Leaf, Moon, RefreshCw, Shirt, Users, Utensils, Dumbbell } from 'lucide-react';
import { ApiError, getCompanion, claimCompanion, restCompanion, openCompanionChest, equipCompanion, companionChallenge } from '../api';
import { COMPANION_ITEMS, demoCompanion, type CompanionItem, type CompanionQuest, type CompanionSnapshot } from '../companion';
import type { FeatureProps, Language, Page } from '../types';
import CompanionAvatar from '../components/CompanionAvatar';
import '../companion.css';

type CompanionProps = FeatureProps & { navigate: (page: Page) => void };
type Operation = { type: 'read' | 'claim' | 'rest' | 'create' | 'leave' } | { type: 'open'; id: string } | { type: 'equip'; item: CompanionItem | null } | { type: 'join'; code: string };
type ViewState = { identity: string; snapshot: CompanionSnapshot | null; busy: boolean; error: string | null };

function useCompanion({ accountId, demo, lang }: FeatureProps) {
  const identity = demo ? 'demo' : accountId ?? '';
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const currentLanguage = useRef(lang);
  currentLanguage.current = lang;
  const generation = useRef(0);
  const alive = useRef(false);
  const busy = useRef(false);
  const readVersion = useRef(0);
  const background = useRef<AbortController | null>(null);
  const controllers = useRef(new Set<AbortController>());
  const [view, setView] = useState<ViewState>(() => ({ identity, snapshot: demo ? demoCompanion() : null, busy: false, error: null }));
  const [notice, setNotice] = useState<string | null>(null);

  const readQuietly = useCallback(async () => {
    if (demo || !accountId || !alive.current || currentIdentity.current !== identity || busy.current || background.current) return;
    const version = generation.current;
    const read = readVersion.current;
    const controller = new AbortController();
    const isCurrent = () => alive.current && generation.current === version && currentIdentity.current === identity && readVersion.current === read && !controller.signal.aborted;
    background.current = controller;
    controllers.current.add(controller);
    try {
      const snapshot = await getCompanion(accountId, controller.signal);
      if (!isCurrent()) return;
      setView(previous => !isCurrent() || previous.identity !== identity || JSON.stringify(previous.snapshot) === JSON.stringify(snapshot) ? previous : { ...previous, snapshot });
    } catch (error) {
      if (!isCurrent()) return;
      // Ordinary background failures stay silent; an expired identity must stop showing private data.
      if (error instanceof ApiError && (error.status === 401 || error.code === 'ACCOUNT_CHANGED')) {
        setView(previous => isCurrent() ? { identity, snapshot: null, busy: false, error: error.message } : previous);
        setNotice(previous => isCurrent() ? null : previous);
      }
    } finally {
      controllers.current.delete(controller);
      if (background.current === controller) background.current = null;
    }
  }, [accountId, demo, identity]);

  const run = useCallback(async function perform(operation: Operation): Promise<boolean> {
    if (demo || !accountId || !alive.current || currentIdentity.current !== identity) return false;
    if (busy.current) return false;
    // A user action always takes priority over a quiet read, including its late response.
    readVersion.current += 1;
    background.current?.abort();
    background.current = null;
    const version = generation.current;
    const controller = new AbortController();
    const isCurrent = () => alive.current && generation.current === version && currentIdentity.current === identity;
    controllers.current.add(controller);
    busy.current = true;
    setView(previous => ({ identity, snapshot: previous.identity === identity ? previous.snapshot : null, busy: true, error: null }));
    try {
      const signal = controller.signal;
      let snapshot: CompanionSnapshot;
      switch (operation.type) {
        case 'read': snapshot = await getCompanion(accountId, signal); break;
        case 'claim': snapshot = await claimCompanion(accountId, signal); break;
        case 'rest': snapshot = await restCompanion(accountId, signal); break;
        case 'open': snapshot = await openCompanionChest(operation.id, accountId, signal); break;
        case 'equip': snapshot = await equipCompanion(operation.item, accountId, signal); break;
        case 'join': snapshot = await companionChallenge('join', operation.code, accountId, signal); break;
        case 'create': snapshot = await companionChallenge('create', undefined, accountId, signal); break;
        case 'leave': snapshot = await companionChallenge('leave', undefined, accountId, signal); break;
      }
      if (!isCurrent()) return false;
      setView({ identity, snapshot, busy: false, error: null });
      setNotice(identity);
      return true;
    } catch (error) {
      if (!isCurrent() || controller.signal.aborted) return false;
      const zh = currentLanguage.current === 'zh';
      const accountChanged = error instanceof ApiError && (error.status === 401 || error.code === 'ACCOUNT_CHANGED');
      const message = error instanceof ApiError && error.code === 'CHALLENGE_UNAVAILABLE'
        ? (zh ? '邀请码已失效、已到期或人数已满，请核对后再试。' : 'This invite is unavailable, expired or full. Check the code and try again.')
        : error instanceof ApiError ? error.message : (zh ? '暂时无法连接，请稍后重试。' : 'Unable to connect. Please try again.');
      setView(previous => ({ identity, snapshot: accountChanged ? null : previous.identity === identity ? previous.snapshot : null, busy: false, error: message }));
      if (accountChanged) setNotice(null);
      return false;
    } finally {
      controllers.current.delete(controller);
      if (isCurrent()) busy.current = false;
    }
  }, [accountId, demo, identity]);

  useEffect(() => {
    generation.current += 1;
    alive.current = true;
    busy.current = false;
    readVersion.current += 1;
    background.current = null;
    setNotice(null);
    setView({ identity, snapshot: demo ? demoCompanion() : null, busy: false, error: null });
    if (!demo && accountId) void run({ type: 'read' });
    return () => {
      alive.current = false;
      generation.current += 1;
      controllers.current.forEach(controller => controller.abort());
      controllers.current.clear();
      readVersion.current += 1;
      background.current = null;
    };
  }, [identity, demo, accountId, run]);

  useEffect(() => {
    if (demo || !accountId) return;
    // Health saves settle rewards on the server. Polling only reads, independently of array identity.
    const refresh = () => { if (document.visibilityState === 'visible') void readQuietly(); };
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [accountId, demo, readQuietly]);

  const visible = view.identity === identity ? view : { identity, snapshot: null, busy: false, error: null };
  return { ...visible, notice: notice === identity, run, disabled: demo || !accountId || visible.busy };
}

const itemNames: Record<CompanionItem, [string, string]> = {
  leaf: ['小叶别针', 'Leaf pin'], cap: ['晴空小帽', 'Sky cap'], star: ['星星徽章', 'Star badge'],
  scarf: ['暖暖围巾', 'Cozy scarf'], flower: ['花朵发饰', 'Flower clip'], crown: ['阳光小冠', 'Sun crown'],
};
const itemName = (item: CompanionItem, zh: boolean) => itemNames[item][zh ? 0 : 1];
const questInfo: Record<CompanionQuest, { zh: string; en: string; page: Page; Icon: typeof Utensils }> = {
  nutrition: { zh: '记录一份饮食', en: 'Log a meal', page: 'nutrition', Icon: Utensils },
  movement: { zh: '记录训练或选择休息', en: 'Log training or choose rest', page: 'training', Icon: Dumbbell },
  sleep: { zh: '记录一次睡眠', en: 'Log your sleep', page: 'sleep', Icon: Moon },
};

function Progress({ snapshot, zh }: { snapshot: CompanionSnapshot; zh: boolean }) {
  const progress = snapshot.xp % 100;
  return <div className="companion-progress">
    <div className="companion-progress-label"><strong data-testid="companion-level">{zh ? '等级' : 'Level'} {snapshot.level}</strong><span><b data-testid="companion-xp">{snapshot.xp}</b> XP</span></div>
    <progress max={100} value={progress} aria-label={zh ? '本级成长进度' : 'Progress in this level'} />
    <span className="companion-small">{zh ? `距下一级还差 ${100 - progress} XP` : `${100 - progress} XP to the next level`}</span>
  </div>;
}

function Quests({ snapshot, lang, navigate, compact = false }: { snapshot: CompanionSnapshot; lang: Language; navigate: (page: Page) => void; compact?: boolean }) {
  const zh = lang === 'zh';
  return <div className={`companion-quests ${compact ? 'companion-quests-compact' : ''}`}>
    {snapshot.quests.map(quest => {
      const info = questInfo[quest.id];
      return <button key={quest.id} className={`companion-quest ${quest.completed ? 'is-complete' : ''}`} data-quest={quest.id} onClick={() => navigate(info.page)}>
        <span className="companion-quest-icon"><info.Icon size={19} /></span>
        <span className="companion-quest-copy"><strong>{zh ? info.zh : info.en}</strong><span>{quest.completed ? (zh ? '已领取成长奖励' : 'Growth reward claimed') : (zh ? '保存记录后确认' : 'Confirmed after saving')}</span></span>
        <span className="companion-quest-result">{quest.completed ? <Check size={18} aria-label={zh ? '已领取' : 'Claimed'} /> : `+${quest.xp} XP`}</span>
      </button>;
    })}
  </div>;
}

function LoadState({ model, zh, compact = false }: { model: ReturnType<typeof useCompanion>; zh: boolean; compact?: boolean }) {
  return <div className={`companion-feedback ${compact ? 'companion-feedback-compact' : ''}`}>
    {model.error ? <p role="alert">{model.error}</p> : <p role="status">{model.busy ? (zh ? '正在确认已保存的进度…' : 'Checking saved progress…') : (zh ? '登录后，伙伴会陪你从第一份记录开始。' : 'Sign in to start with your first saved record.')}</p>}
    {model.error && <button className="btn btn-secondary" disabled={model.disabled} onClick={() => void model.run({ type: 'read' })}><RefreshCw size={15} />{zh ? '重试' : 'Retry'}</button>}
  </div>;
}

export function CompanionCard(props: CompanionProps) {
  const model = useCompanion(props);
  const { snapshot } = model;
  const zh = props.lang === 'zh';
  return <section className="panel companion-card" aria-label={zh ? '健康伙伴' : 'Health companion'}>
    <div className="companion-card-heading"><span className="companion-eyebrow"><Leaf size={16} />{zh ? '健康伙伴' : 'Health companion'}</span>{props.demo && <span className="companion-badge">{zh ? '演示数据' : 'Demo data'}</span>}</div>
    <div className="companion-card-intro">
      <CompanionAvatar equipped={snapshot?.equipped} level={snapshot?.level} />
      <div><h2>{zh ? '和芽芽，一起慢慢长大。' : 'Grow at your pace with Sprout.'}</h2><p>{zh ? '每一份记录，都是一次陪伴。' : 'A little company for every log.'}</p></div>
    </div>
    {snapshot ? <><Progress snapshot={snapshot} zh={zh} /><Quests snapshot={snapshot} lang={props.lang} navigate={props.navigate} compact />{model.error && <div><p className="companion-inline-error" role="alert">{model.error}</p><button className="text-button" disabled={model.disabled} onClick={() => void model.run({ type: 'read' })}>{zh ? '重试' : 'Retry'}</button></div>}</> : <LoadState model={model} zh={zh} compact />}
    <p className="companion-small">{zh ? 'XP 仅代表游戏成长进度。' : 'XP is game progress only.'}</p>
    <button className="btn btn-tint companion-card-link" onClick={() => props.navigate('companion')}>{zh ? '看看伙伴成长' : 'Visit your companion'}<ArrowRight size={17} /></button>
  </section>;
}

export default function Companion(props: CompanionProps) {
  const { lang, demo, accountId, navigate } = props;
  const zh = lang === 'zh';
  const model = useCompanion(props);
  const { snapshot, run, disabled } = model;
  const [code, setCode] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => { setCode(''); setConfirmLeave(false); }, [accountId, demo]);
  const movementComplete = snapshot?.quests.find(quest => quest.id === 'movement')?.completed;
  const pendingChests = snapshot?.chests.filter(chest => !chest.openedAt) ?? [];
  const openedChests = snapshot?.chests.filter(chest => chest.openedAt) ?? [];
  const challenge = snapshot?.challenge;
  const challengeEnded = challenge ? Date.now() >= Date.parse(challenge.endsAt) : false;
  const challengeEnd = challenge ? new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(challenge.endsAt)) : '';
  const normalizedCode = code.trim().toUpperCase();

  return <section className="companion-page" aria-label={zh ? '伙伴成长' : 'Companion growth'}>
    <header className="companion-page-heading"><div><span className="companion-eyebrow"><Leaf size={17} />FORMA COMPANION</span><h1>{zh ? '一起，慢慢长大。' : 'A little growth, together.'}</h1><p>{zh ? '记录、休息、再出发。芽芽按你的节奏陪伴。' : 'Log, rest and begin again. Sprout moves at your pace.'}</p></div><button className="btn btn-secondary" disabled={disabled} onClick={() => void run({ type: 'claim' })}><RefreshCw size={17} />{zh ? '同步成长' : 'Sync progress'}</button></header>
    {demo && <p className="companion-demo" role="note">{zh ? '演示数据 · 可以浏览和前往记录页面；奖励、换装与挑战不会保存。' : 'Demo data · explore and visit your logs. Rewards, outfits and challenges cannot be saved.'}</p>}
    <div className="companion-live" aria-live="polite" aria-atomic="true">{model.busy ? (zh ? '正在确认已保存的进度…' : 'Checking saved progress…') : model.error ? '' : model.notice ? (zh ? '已确认保存的成长进度。' : 'Saved growth progress confirmed.') : ''}</div>
    {model.error && snapshot && <div className="companion-error"><p role="alert">{model.error}</p><button className="text-button" disabled={disabled} onClick={() => void run({ type: 'read' })}>{zh ? '重新读取' : 'Reload progress'}</button></div>}
    {!snapshot ? <div className="panel"><LoadState model={model} zh={zh} /></div> : <>
      <div className="companion-main-grid">
        <section className="panel companion-home" aria-label={zh ? '芽芽的成长' : 'Sprout’s growth'}>
          <div className="companion-avatar-scene"><span className="companion-scene-orbit" /><CompanionAvatar equipped={snapshot.equipped} level={snapshot.level} label={zh ? '芽芽，Forma 原创植物伙伴' : 'Sprout, Forma’s original plant companion'} /><span className="companion-scene-caption">{zh ? '按自己的节奏就好' : 'Your pace is enough'}</span></div>
          <div className="companion-home-copy"><h2>{zh ? '你好，我是芽芽。' : 'Hi, I’m Sprout.'}</h2><p>{zh ? '你回来时，我一直在。漏记不会扣分，也不会失去外观。' : 'I’m here whenever you return. Missing a log never costs XP or outfits.'}</p><Progress snapshot={snapshot} zh={zh} /><div className="companion-days"><span><strong data-testid="companion-active-days">{snapshot.activeDays}</strong> {zh ? '个成长日' : 'growth days'}</span><span>{zh ? '每 3 个成长日解锁免费宝箱' : 'A free chest every 3 growth days'}</span></div><p className="companion-small">{zh ? 'XP 和等级只代表游戏进度，不是健康评分。' : 'XP and levels show game progress, never a health score.'}</p></div>
        </section>
        <section className="panel companion-daily" aria-label={zh ? '今日成长任务' : 'Today’s growth quests'}>
          <div className="companion-section-title"><div><span className="companion-eyebrow">{zh ? '一点点就很好' : 'SMALL STEPS COUNT'}</span><h2>{zh ? '今天的三份陪伴' : 'Three ways to grow today'}</h2></div><span className="companion-badge">{snapshot.day} UTC</span></div>
          <Quests snapshot={snapshot} lang={lang} navigate={navigate} />
          <button className="btn btn-secondary companion-rest" disabled={disabled || movementComplete} onClick={() => void run({ type: 'rest' })}><Moon size={17} />{zh ? '今天休息' : 'Rest today'}<span>+10 XP</span></button>
          <p className="companion-small">{zh ? '休息与训练任选其一，奖励相同。功能启用后新保存的当天记录才参与结算，旧记录和编辑不补发。每类最多 10 XP，每个 UTC 日合计最多 30 XP。同一本地记录日不会重复领取，切换时区不增加额度。UTC 00:00 切换奖励日。' : 'Rest and training earn the same reward; choose either. Only new current-day logs saved after this feature starts qualify; older logs and edits do not earn backdated rewards. Each category earns up to 10 XP, with a 30 XP limit per UTC day. The same local log day cannot earn twice; changing time zones adds no allowance. Reward days change at 00:00 UTC.'}</p>
        </section>
      </div>

      <section className="panel companion-wardrobe" aria-label={zh ? '宝箱与外观' : 'Chests and outfits'}>
        <div className="companion-section-title"><div><span className="companion-eyebrow"><Shirt size={16} />{zh ? '给成长留个纪念' : 'LITTLE KEEPSAKES'}</span><h2>{zh ? '芽芽的衣橱' : 'Sprout’s wardrobe'}</h2></div><span className="companion-badge">{zh ? '全部免费' : 'Always free'}</span></div>
        <div className="companion-chests">
          <Gift size={25} aria-hidden="true" />
          <div><strong>{pendingChests.length ? (zh ? `${pendingChests.length} 个宝箱等你开启` : `${pendingChests.length} ${pendingChests.length === 1 ? 'chest is' : 'chests are'} ready`) : (zh ? `再获得 ${3 - snapshot.activeDays % 3} 个成长日解锁下个宝箱` : `${3 - snapshot.activeDays % 3} more growth ${3 - snapshot.activeDays % 3 === 1 ? 'day' : 'days'} to your next chest`)}</strong><p>{zh ? '外观按固定顺序解锁，没有付费或随机抽取。' : 'Outfits unlock in a fixed order. No purchases or random draws.'}</p></div>
          <div className="companion-chest-actions">{pendingChests.map(chest => <button key={chest.id} className="btn btn-primary" data-chest-id={chest.id} disabled={disabled} onClick={() => void run({ type: 'open', id: chest.id })}>{zh ? `开启第 ${chest.milestone} 日宝箱` : `Open day ${chest.milestone} chest`}</button>)}</div>
        </div>
        <div className="companion-outfits">{COMPANION_ITEMS.map(item => {
          const owned = snapshot.inventory.includes(item);
          const selected = snapshot.equipped === item;
          return <button key={item} data-item={item} className={`companion-outfit ${selected ? 'is-equipped' : ''}`} disabled={disabled || !owned} aria-pressed={selected} aria-label={`${itemName(item, zh)} · ${selected ? (zh ? '已佩戴' : 'Equipped') : owned ? (zh ? '佩戴' : 'Equip') : (zh ? '尚未解锁' : 'Locked')}`} onClick={() => void run({ type: 'equip', item })}><CompanionAvatar equipped={item} /><strong>{itemName(item, zh)}</strong><span>{selected ? (zh ? '已佩戴' : 'Equipped') : owned ? (zh ? '佩戴' : 'Equip') : (zh ? '成长日解锁' : 'Unlock by growing')}</span></button>;
        })}</div>
        <div className="companion-wardrobe-footer"><span className="companion-small">{zh ? `已开启 ${openedChests.length} 个宝箱 · 已拥有 ${snapshot.inventory.length} 款外观` : `${openedChests.length} chests opened · ${snapshot.inventory.length} outfits owned`}</span><button className="text-button" disabled={disabled || snapshot.equipped === null} onClick={() => void run({ type: 'equip', item: null })}>{zh ? '暂时不戴配饰' : 'Wear no accessory'}</button></div>
      </section>

      <section className="panel companion-challenge" aria-label={zh ? '七日同行挑战' : 'Seven-day companion challenge'}>
        <div className="companion-section-title"><div><span className="companion-eyebrow"><Users size={16} />{zh ? '邀请一位朋友' : 'BRING A FRIEND'}</span><h2>{zh ? '七日，一起出现。' : 'Show up together for seven days.'}</h2></div><span className="companion-badge">{zh ? '仅限两人' : 'Just two people'}</span></div>
        <p className="companion-challenge-description">{zh ? '彼此只看到有奖励的参与天数，每天最多计 1 天。不分享姓名、邮箱或任何健康记录。并列就是共同完成。' : 'Share only rewarded participation days, at most one per day. Names, emails and health records stay private. A tie is a shared finish.'}</p>
        {challenge ? <div className="companion-challenge-active">
          {challengeEnded ? <div className="companion-result"><h3>{zh ? '本次七日结果' : 'Your seven-day results'}</h3><p>{challenge.participants.length === 2 && challenge.participants[0].days === challenge.participants[1].days ? (zh ? '并列，一起完成。' : 'A tie. A shared finish.') : (zh ? '每一次出现，都值得纪念。' : 'Every day you showed up counts.')}</p><span className="companion-small">{zh ? '已结束' : 'Ended'} · {challengeEnd} UTC</span><p className="companion-small">{zh ? '结果在结束后保留展示 48 小时。此邀请码已失效。' : 'Results remain visible for 48 hours after the end. This invite has expired.'}</p><button className="btn btn-primary" disabled={disabled} onClick={() => { setConfirmLeave(false); void run({ type: 'create' }); }}>{zh ? '开始新的七日挑战' : 'Start a new seven-day challenge'}<ArrowRight size={17} /></button></div> : <div className="companion-invite"><label htmlFor="companion-invite">{zh ? '私密邀请码 · 仅分享给受邀朋友' : 'Private invite · share only with your friend'}</label><input id="companion-invite" value={challenge.code} readOnly onFocus={event => event.currentTarget.select()} /><span className="companion-small">{zh ? '结束时间' : 'Ends'} · {challengeEnd} UTC</span></div>}
          <div className="companion-participants">{challenge.participants.map((participant, index) => <div key={`${participant.self}-${index}`}><span>{participant.self ? (zh ? '你' : 'You') : (zh ? '同行伙伴' : 'Your partner')}</span><strong>{participant.days} <small>/ 7 {zh ? '天' : 'days'}</small></strong></div>)}{challenge.participants.length < 2 && <div className="companion-waiting"><span>{challengeEnded ? (zh ? '本次没有同行伙伴' : 'No partner joined this time') : (zh ? '等待朋友加入' : 'Waiting for a friend')}</span><strong>—</strong></div>}</div>
          {confirmLeave ? <div className="companion-leave-confirm" role="group" aria-label={challengeEnded ? (zh ? '确认清除结果' : 'Confirm clearing results') : (zh ? '确认退出挑战' : 'Confirm leaving challenge')}><p>{challengeEnded ? (zh ? '清除本次挑战结果，已有 XP 与外观保留。' : 'Clear this challenge result. Your XP and outfits stay.') : (zh ? '退出后，本次挑战和邀请码将对双方失效。已有 XP 与外观保留。' : 'Leaving ends this challenge and invalidates the invite for both people. Your XP and outfits stay.')}</p><button className="btn btn-secondary" disabled={disabled} onClick={() => { setConfirmLeave(false); void run({ type: 'leave' }); }}>{challengeEnded ? (zh ? '确认清除' : 'Confirm clear') : (zh ? '确认退出' : 'Confirm leave')}</button><button className="text-button" onClick={() => setConfirmLeave(false)}>{challengeEnded ? (zh ? '保留结果' : 'Keep results') : (zh ? '继续同行' : 'Keep going together')}</button></div> : <button className="text-button" disabled={disabled} onClick={() => setConfirmLeave(true)}>{challengeEnded ? (zh ? '清除本次结果' : 'Clear these results') : (zh ? '退出并废止邀请码' : 'Leave and invalidate invite')}</button>}
        </div> : <div className="companion-challenge-start"><div><h3>{zh ? '发出一份邀请' : 'Start with an invitation'}</h3><p>{zh ? '创建后开始计时，由你选择分享给谁。' : 'The seven days start when you create it. You choose who receives the code.'}</p><button className="btn btn-primary" disabled={disabled} onClick={() => void run({ type: 'create' })}>{zh ? '创建七日挑战' : 'Create seven-day challenge'}<ArrowRight size={17} /></button></div><form onSubmit={event => { event.preventDefault(); if (/^[A-F0-9]{16}$/.test(normalizedCode) && !disabled) void run({ type: 'join', code: normalizedCode }); }}><label htmlFor="companion-join">{zh ? '已有朋友的邀请码？' : 'Have a friend’s invite?'}</label><div className="companion-join-row"><input id="companion-join" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={24} value={code} onChange={event => setCode(event.target.value)} placeholder={zh ? '16 位邀请码' : '16-character invite'} disabled={disabled} aria-describedby="companion-join-hint" /><button type="submit" className="btn btn-secondary" disabled={disabled || !/^[A-F0-9]{16}$/.test(normalizedCode)}>{zh ? '加入' : 'Join'}</button></div><p id="companion-join-hint" className="companion-small">{zh ? '加入即向对方展示你的参与天数，随时可以退出。' : 'Joining shares your participation days with them. You can leave at any time.'}</p></form></div>}
      </section>
      <p className="companion-footnote">{zh ? '免费陪伴，不催促、不惩罚。游戏奖励不会改变饮食、训练或睡眠建议。' : 'Free company, without pressure or penalties. Game rewards never change nutrition, training or sleep guidance.'}</p>
    </>}
  </section>;
}
