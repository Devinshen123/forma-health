import { useEffect, useRef, useState } from "react";
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
import Training from "./features/Training";
import Sleep from "./features/Sleep";
import Reports from "./features/Reports";
import Trends from "./features/Trends";
import Plan from "./features/Plan";
import Onboarding from "./features/Onboarding";
import Settings from "./features/Settings";
import { Auth } from "./components/Auth";
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
  const revision = useRef(0);
  const saving = useRef(false);
  const sessionEpoch = useRef(0);
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
      try {
        const { user: current } = await api.getMe();
        if (!active || epoch !== sessionEpoch.current) return;
        if (current) {
          api.setAccountHint(current.id);
          const snap = await api.getState();
          if (!active || epoch !== sessionEpoch.current) return;
          setUser(current);
          setState(snap.state);
          revision.current = snap.revision;
          setDemo(false);
          setOnboarding(!snap.state.profile);
        }
      } catch {
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
  async function save(next: AppState) {
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
    saving.current = true;
    const epoch = sessionEpoch.current;
    try {
      const snapshot = await api.putState(next, revision.current);
      if (epoch !== sessionEpoch.current) return;
      revision.current = snapshot.revision;
      setState(snapshot.state);
    } catch (err) {
      if (epoch !== sessionEpoch.current) return;
      if (err instanceof api.ApiError && err.status === 401) {
        resetSession();
        setAuth(true);
      }
      if (err instanceof api.ApiError && err.status === 409) {
        const snapshot = await api.getState();
        if (epoch !== sessionEpoch.current) return;
        setState(snapshot.state);
        revision.current = snapshot.revision;
      }
      throw err;
    } finally {
      saving.current = false;
    }
  }
  async function authenticated(current: User) {
    const epoch = ++sessionEpoch.current;
    api.setAccountHint(current.id);
    const snapshot = await api.getState();
    if (epoch !== sessionEpoch.current) return;
    setUser(current);
    setState(snapshot.state);
    revision.current = snapshot.revision;
    setDemo(false);
    setAuth(false);
    setOnboarding(!snapshot.state.profile);
    setPage("today");
    localStorage.setItem("forma-session-change", crypto.randomUUID());
    notify("账户已准备好。", "Your account is ready.");
  }
  function resetSession() {
    sessionEpoch.current++;
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
    sessionEpoch.current++;
    await api.logout();
    resetSession();
    localStorage.setItem("forma-session-change", crypto.randomUUID());
  }
  function accountDeleted() {
    resetSession();
    localStorage.setItem("forma-session-change", crypto.randomUUID());
  }
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === "forma-session-change") {
        resetSession();
        notify(
          "另一窗口更新了账户，请重新登录。",
          "Your account changed in another tab. Sign in again.",
        );
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [user, lang]);
  function navigate(p: Page) {
    setPage(p);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const props = { state, lang, save, notify, demo };
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
        {onboarding ? (
          <Onboarding
            {...props}
            accountName={user?.name}
            draftKey={
              demo ? "Forma-onboarding-demo" : `Forma-onboarding-${user?.id}`
            }
            onComplete={() => {
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
              <Nutrition {...props} />
            ) : page === "training" ? (
              <Training {...props} />
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
