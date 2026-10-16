import { Fragment, lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Home,
  Utensils,
  Dumbbell,
  Moon,
  ChartNoAxesColumnIncreasing,
  FileText,
  Settings as SettingsIcon,
  ArrowRight,
  X,
  Menu,
  Info,
} from "lucide-react";
import type { AppState, Language, Page, User } from "./types";
import { demoState } from "./demo";
import * as api from "./api";
import Dashboard from "./features/Dashboard";
import Nutrition from "./features/Nutrition";
const Training = lazy(() => import("./features/Training"));
import Sleep from "./features/Sleep";
import Reports from "./features/Reports";
import Trends from "./features/Trends";
import Plan from "./features/Plan";
import Onboarding from "./features/Onboarding";
import Settings from "./features/Settings";
import { Auth } from "./components/Auth";
import SyncPanel from "./components/SyncPanel";
import { SyncEngine, type SyncStatus } from "./sync/engine";
import { readCached } from "./sync/storage";
import { assertWriteBinding } from "./sync/lifecycle";
import { Modal } from "./components/Modal";
const navigation = [
  { page: "today", zh: "今日", en: "Today", Icon: Home },
  { page: "nutrition", zh: "饮食", en: "Nutrition", Icon: Utensils },
  { page: "training", zh: "训练", en: "Training", Icon: Dumbbell },
  { page: "sleep", zh: "睡眠", en: "Sleep", Icon: Moon },
  {
    page: "trends",
    zh: "趋势",
    en: "Trends",
    Icon: ChartNoAxesColumnIncreasing,
  },
  { page: "reports", zh: "报告", en: "Reports", Icon: FileText },
] as const;
function Brand() {
  return (
    <span className="brand">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M21 13c-9-10-20 6-9 11 9 5 20-11 9-11zM19 27c9 10 20-6 9-11-9-5-20 11-9 11z" />
      </svg>
      Forma
    </span>
  );
}
export default function App() {
  const [lang, setLang] = useState<Language>(() =>
    localStorage.getItem("forma-language") === "en" ? "en" : "zh",
  );
  const [state, setState] = useState<AppState>(() => demoState());
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(true);
  const [page, setPage] = useState<Page>("today");
  const [auth, setAuth] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [unsaved,setUnsaved] = useState({dirty:false,busy:false});
  const [leavePage,setLeavePage] = useState<Page|null>(null);
  const revision = useRef(0);
  const sync = useRef<SyncEngine | null>(null);
  const retainedEngines = useRef(new Map<string,SyncEngine>());
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const writeContext = sync.current?.context();
  const writeEngine = sync.current;
  const saving = useRef<symbol | null>(null);
  const sessionEpoch = useRef(0);
  const writeBinding = { epoch: sessionEpoch.current, accountId: user?.id, engine: writeEngine };
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const zh = lang === "zh";
  function notify(a: string, b?: string) {
    setToast(zh ? a : b || a);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    localStorage.setItem("forma-language", lang);
  }, [lang]);
  useEffect(() => {
    let active = true;
    async function boot() {
      const epoch = sessionEpoch.current;
      let verifiedId: string | undefined;
      try {
        const { user: current } = await api.getMe();
        verifiedId=current?.id;
        if (!active || epoch !== sessionEpoch.current) return;
        if (current) {
          api.setAccountHint(current.id);
          const snap = await api.getSync(current.id);
          if (!active || epoch !== sessionEpoch.current) return;
          setUser(current);
          setState(snap.state);
          revision.current = snap.revision;
          setDemo(false);
          setOnboarding(!snap.state.profile);
          localStorage.setItem('forma-active-account',current.id);
          await startSync(current, snap, epoch);
        } else localStorage.removeItem('forma-active-account');
      } catch (cause) {
        const transportFailure=cause instanceof TypeError || cause instanceof DOMException && cause.name==='TimeoutError';
        const activeAccount=localStorage.getItem('forma-active-account');
        const cached = transportFailure&&activeAccount ? await readCached(activeAccount).catch(()=>undefined) : undefined;
        if(transportFailure && active && epoch === sessionEpoch.current && activeAccount===localStorage.getItem('forma-active-account') && cached && (!verifiedId||verifiedId===cached.user.id) && localStorage.getItem(`forma-offline-${cached.user.id}`)==='enabled') {
          api.setAccountHint(cached.user.id);setUser(cached.user);setDemo(false);setOnboarding(false);
          await startSync(cached.user,cached.snapshot,epoch);
          setToast(lang==='zh'?'已打开本机离线记录；联网后会重新验证账户。':'Opened offline records. Your account will be verified when connected.');
        } else
        if (active && epoch === sessionEpoch.current)
          setToast(
            lang === "zh"
              ? "账户服务暂不可用；当前为演示模式。"
              : "Account service unavailable; showing demo mode.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void boot();
    return () => {
      active = false;
    };
  }, []);
  async function startSync(current:User,snapshot:import('./types').SyncSnapshot,epoch:number) {
    const changed = (next:AppState,status:SyncStatus)=>{if(epoch===sessionEpoch.current){setState(next);setSyncStatus(status);}};
    if(sync.current?.user.id===current.id){const engine=sync.current;await engine.reauthenticate(snapshot,changed);if(epoch===sessionEpoch.current)void engine.refresh();return;}
    if(sync.current){retainedEngines.current.set(sync.current.user.id,sync.current);await sync.current.stop();}
    if(epoch!==sessionEpoch.current)return;
    const retained=retainedEngines.current.get(current.id);
    if(retained){retainedEngines.current.delete(current.id);sync.current=retained;await retained.reauthenticate(snapshot,changed);if(epoch===sessionEpoch.current)void retained.refresh();return;}
    const engine = new SyncEngine(current,snapshot,changed);
    sync.current=engine;await engine.restore();if(epoch!==sessionEpoch.current){await engine.stop();return;}void engine.refresh();
  }
  useEffect(()=>{const refresh=()=>void sync.current?.refresh();window.addEventListener('online',refresh);window.addEventListener('offline',refresh);const timer=setInterval(refresh,15000);return()=>{clearInterval(timer);window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);};},[]);
  useEffect(()=>{const preventLoss=(event:BeforeUnloadEvent)=>{const engines=[sync.current,...retainedEngines.current.values()];if(engines.some(engine=>engine&&engine.status.pending&&!engine.status.enabled)){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',preventLoss);return()=>window.removeEventListener('beforeunload',preventLoss);},[]);
  async function save(next: AppState) {
    assertWriteBinding(writeBinding,{epoch:sessionEpoch.current,accountId:sync.current?.user.id,engine:sync.current});
    if (demo) {
      setState(next);
      return;
    }
    if (saving.current)
      throw new Error(
        zh
          ? "上一条记录正在保存，请稍等。"
          : "Please wait for the current save.",
      );
    const saveToken = Symbol();
    saving.current = saveToken;
    const epoch = sessionEpoch.current;
    try {
      if(writeEngine) {await writeEngine.save(next,writeContext);assertWriteBinding(writeBinding,{epoch:sessionEpoch.current,accountId:sync.current?.user.id,engine:sync.current});return;}
      const snapshot = await api.putState(next, revision.current,writeBinding.accountId ?? null);
      if (epoch !== sessionEpoch.current) throw Error('Account changed. Reopen the editor before saving.');
      revision.current = snapshot.revision;
      setState(snapshot.state);
    } catch (err) {
      if (epoch !== sessionEpoch.current) throw Error('Account changed. Reopen the editor before saving.');
      if (err instanceof api.ApiError && err.status === 401) {
        if(!sync.current)resetSession();
        setAuth(true);
      }
      if (err instanceof api.ApiError && err.status === 409 && !sync.current) {
        const snapshot = await api.getState();
        if (epoch !== sessionEpoch.current) return;
        setState(snapshot.state);
        revision.current = snapshot.revision;
      }
      throw err;
    } finally {
      if(saving.current===saveToken)saving.current = null;
    }
  }
  async function authenticated(current: User) {
    const startingEpoch = writeBinding.epoch;
    if(startingEpoch!==sessionEpoch.current)throw Error('Account changed. Sign in again.');
    const snapshot = await api.getSync(current.id);
    if (startingEpoch !== sessionEpoch.current) return;
    const epoch = ++sessionEpoch.current;
    saving.current=null;
    setUnsaved({dirty:false,busy:false});setLeavePage(null);
    api.setAccountHint(current.id);
    localStorage.setItem('forma-active-account',current.id);
    setUser(current);
    setState(snapshot.state);
    revision.current = snapshot.revision;
    setDemo(false);
    setAuth(false);
    setOnboarding(!snapshot.state.profile);
    if(user?.id!==current.id)setPage("today");
    await startSync(current,snapshot,epoch);
    if(epoch!==sessionEpoch.current)return;
    localStorage.setItem("forma-session-change", crypto.randomUUID());
    notify("账户已准备好。", "Your account is ready.");
  }
  function resetSession(clearCache=true,force=false) {
    sessionEpoch.current++;
    if(sync.current){if(clearCache)retainedEngines.current.delete(sync.current.user.id);else retainedEngines.current.set(sync.current.user.id,sync.current);}
    saving.current=null;
    setUnsaved({dirty:false,busy:false});setLeavePage(null);
    if(clearCache&&localStorage.getItem('forma-active-account')===user?.id)localStorage.removeItem('forma-active-account');
    void sync.current?.stop(clearCache,force).catch(()=>notify('待同步记录已保留，请登录原账户后恢复。','Pending records preserved. Sign in to the original account to restore them.'));sync.current=null;setSyncStatus(null);
    api.setAccountHint(null);
    if (user) localStorage.removeItem(`Forma-onboarding-${user.id}`);
    setUser(null);
    setDemo(true);
    setState(demoState());
    setOnboarding(false);
    setPage("today");
    setAuth(false);
  }
  async function signOut() {
    assertWriteBinding(writeBinding,{epoch:sessionEpoch.current,accountId:sync.current?.user.id,engine:sync.current});
    if(sync.current?.status.pending)throw Error(zh?'请先同步或导出并放弃待同步更改，再退出。':'Sync, or export and discard pending changes before signing out.');
    try {await api.logout();}catch(e){if(navigator.onLine)throw e;}
    assertWriteBinding(writeBinding,{epoch:sessionEpoch.current,accountId:sync.current?.user.id,engine:sync.current});
    resetSession();
    localStorage.setItem("forma-session-change", crypto.randomUUID());
  }
  function accountDeleted() {
    if(writeBinding.epoch!==sessionEpoch.current)return;
    resetSession(true,true);
    localStorage.setItem("forma-session-change", crypto.randomUUID());
  }
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === "forma-session-change") {
        resetSession(false);
        notify(
          "另一窗口更新了账户。待同步记录已保留，请登录原账户后恢复。",
          "Account changed in another tab. Pending records are preserved; sign in to the original account to restore them.",
        );
      }
      if(user&&[ `forma-cache-update-${user.id}`, `forma-offline-${user.id}` ].includes(event.key??''))void sync.current?.reconcileCache();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [user, lang]);
  function navigate(p: Page,force=false) {
    if(page==='training'&&p!=='training'&&!force){if(unsaved.busy)return;if(unsaved.dirty){setLeavePage(p);return;}}
    if(force)setUnsaved({dirty:false,busy:false});
    setPage(p);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const props = { state, lang, save, notify:(a:string,b?:string)=>{if(writeBinding.epoch===sessionEpoch.current)notify(a,b);}, demo, accountId:user?.id, onUnsavedChange:(dirty:boolean,busy:boolean)=>{if(writeBinding.epoch===sessionEpoch.current)setUnsaved(current=>current.dirty===dirty&&current.busy===busy?current:{dirty,busy});} };
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <p>{zh ? "准备你的下一步…" : "Preparing your next step…"}</p>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <Brand />
        <nav aria-label={zh ? "主导航" : "Main navigation"}>
          {navigation.map((n) => (
            <button
              key={n.page}
              onClick={() => navigate(n.page)}
              className={page === n.page ? "nav-item active" : "nav-item"}
              aria-current={page === n.page ? "page" : undefined}
            >
              <n.Icon size={22} />
              <span>
                {zh ? `${n.zh} / ` : ""}
                {n.en}
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            onClick={() => navigate("settings")}
            className={`nav-item ${page === "settings" ? "active" : ""}`}
          >
            <SettingsIcon size={22} />
            <span>{zh ? "设置 / Settings" : "Settings"}</span>
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-scrim"
          onClick={() => setMenu(false)}
          aria-label="Close menu"
        />
      )}
      <main className="main-content">
        <header className="top-header">
          <div className="mobile-brand">
            <Brand />
            <button
              className="icon-button"
              onClick={() => setMenu(!menu)}
              aria-label={zh ? "打开更多导航" : "More navigation"}
            >
              <Menu size={23} />
            </button>
          </div>
          <div className="header-copy">
            <h1>
              {page === "today"
                ? zh
                  ? "把状态，练成习惯。"
                  : "Turn progress into a habit."
                : "Forma"}
            </h1>
            <p>
              {page === "today"
                ? zh
                  ? "每一天，都有适合你的下一步。"
                  : "A next step that fits you. Every day."
                : zh
                  ? "饮食、训练与休息，一起向前。"
                  : "Nutrition, training and rest. Moving together."}
            </p>
          </div>
          <div className="header-tools">
            <button
              className="language-switch"
              onClick={() => setLang(zh ? "en" : "zh")}
              aria-label={zh ? "Switch to English" : "切换简体中文"}
            >
              <span className={zh ? "current" : ""}>中</span>
              <span>/</span>
              <span className={!zh ? "current" : ""}>EN</span>
            </button>
            <button
              className="avatar"
              onClick={() => (demo ? setAuth(true) : navigate("settings"))}
              aria-label={
                demo
                  ? zh
                    ? "创建账户"
                    : "Create account"
                  : zh
                    ? "账户设置"
                    : "Account settings"
              }
            >
              {demo ? "A" : (user?.name?.[0] || "F").toUpperCase()}
            </button>
          </div>
        </header>
        {!demo&&sync.current&&syncStatus&&<SyncPanel key={`sync:${user?.id}:${writeBinding.epoch}`} engine={sync.current} status={syncStatus} lang={lang} expanded={page==='settings'} onReauthenticate={()=>setAuth(true)}/>}
        <Fragment key={`features:${user?.id ?? 'demo'}:${writeBinding.epoch}`}>
        {onboarding ? (
          <Onboarding
            {...props}
            accountName={user?.name}
            draftKey={
              demo ? "Forma-onboarding-demo" : `Forma-onboarding-${user?.id}`
            }
            onComplete={() => {
              if(writeBinding.epoch!==sessionEpoch.current)return;
              setOnboarding(false);
              setPage("today");
            }}
          />
        ) : page === "today" ? (
          <Dashboard
            {...props}
            navigate={navigate}
            onCreate={() => setAuth(true)}
          />
        ) : (
          <>
            <div className="page-topline">
              <button className="text-button" onClick={() => navigate("today")}>
                <ArrowRight size={15} className="back-arrow" />
                {zh ? "回到今日" : "Back to Today"}
              </button>
              {demo && (
                <span className="demo-caption">
                  <Info size={14} />
                  {zh ? "演示数据" : "Demo data"}
                </span>
              )}
            </div>
            {page === "nutrition" ? (
              <Nutrition key={user?.id ?? "demo"} {...props} onCreate={() => setAuth(true)} />
            ) : page === "training" ? (
              <Suspense fallback={<div className="panel">{zh?'载入训练工具…':'Loading training tools…'}</div>}><Training key={user?.id ?? "demo"} {...props} /></Suspense>
            ) : page === "sleep" ? (
              <Sleep {...props} />
            ) : page === "trends" ? (
              <Trends {...props} />
            ) : page === "reports" ? (
              <Reports {...props} />
            ) : page === "plan" ? (
              <Plan {...props} />
            ) : (
              <Settings
                {...props}
                user={user}
                onLogout={signOut}
                onDeleted={accountDeleted}
                onCreate={() => setAuth(true)}
              />
            )}
          </>
        )}
        </Fragment>
        <footer className="app-footer">
          Forma <span>·</span>{" "}
          {zh ? "每天一点，向前一点。" : "Small steps. Steady progress."}
        </footer>
      </main>
      <nav
        className="mobile-nav"
        aria-label={zh ? "手机导航" : "Mobile navigation"}
      >
        {navigation.slice(0, 5).map((n) => (
          <button
            key={n.page}
            className={page === n.page ? "active" : ""}
            onClick={() => navigate(n.page)}
            aria-current={page === n.page ? "page" : undefined}
          >
            <n.Icon size={21} />
            <span>{zh ? n.zh : n.en}</span>
          </button>
        ))}
      </nav>
      {auth && (
        <Auth
          lang={lang}
          onClose={() => setAuth(false)}
          onAuthenticated={authenticated}
        />
      )}{" "}
      {leavePage&&<Modal title={zh?'训练还有未保存输入':'Unsaved training entries'} onClose={()=>setLeavePage(null)} footer={<><button className="btn btn-primary" onClick={()=>setLeavePage(null)}>{zh?'返回训练':'Return to training'}</button><button className="btn btn-secondary" onClick={()=>{navigate(leavePage,true);setLeavePage(null);}}>{zh?'放弃未保存输入并离开':'Discard unsaved entries and leave'}</button></>}><p>{zh?'已保存的进度会保留。当前尚未点击保存的输入将丢失；可以返回训练点击“保存进度”。':'Saved progress is retained. Entries you have not saved will be lost. Return to the session and choose Save progress.'}</p></Modal>}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Dismiss / 关闭">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
