import {
  ArrowRight,
  Utensils,
  Dumbbell,
  Moon,
  Check,
  SlidersHorizontal,
  Info,
  Coffee,
} from "lucide-react";
import {
  currentPlan,
  localDate,
  mealTotals,
  sleepHours,
  type FeatureProps,
  type Page,
} from "../types";
import { assetUrl } from "../api";
export default function Dashboard({
  state,
  lang,
  save,
  notify,
  demo,
  navigate,
  onCreate,
}: { navigate: (p: Page) => void; onCreate: () => void } & FeatureProps) {
  const zh = lang === "zh";
  const today = localDate();
  const plan = currentPlan(state);
  const meals = state.meals.filter((m) => m.date === today);
  const kcals = meals.reduce((sum, m) => sum + mealTotals(m).kcal, 0);
  const workouts = state.workouts.filter((w) => w.date === today);
  const duration = workouts.reduce((sum, w) => sum + w.duration, 0);
  const todaySleeps = state.sleeps.filter((s) => s.date === today);
  const minutes = todaySleeps.length
    ? Math.round(todaySleeps.reduce((sum, s) => sum + sleepHours(s), 0) * 60)
    : null;
  const done = state.completedActions[today] || [];
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return {
      date: localDate(d),
      label: new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
        weekday: "short",
      }).format(d),
    };
  });
  const weekWorkouts = state.workouts.filter((w) =>
    week.some((d) => d.date === w.date),
  );
  const mealDays = new Set(
    state.meals
      .filter((m) => week.some((d) => d.date === m.date))
      .map((m) => m.date),
  ).size;
  const latest = demo
    ? state.meals.find((m) => m.name === "鸡肉杂粮碗")
    : state.meals
        .slice()
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        )[0];
  const actions = [
    {
      key: "nutrition",
      time: "08:00",
      title: zh ? "早餐与能量补给" : "Breakfast & fuel",
      desc: zh ? "营养开启新的一天" : "A nourishing start to the day",
      Icon: Coffee,
      page: "nutrition" as Page,
    },
    {
      key: "training",
      time: "18:00",
      title: zh ? "全身力量训练" : "Full body strength",
      desc: plan
        ? `${plan.trainingMinutes} ${zh ? "分钟 · 按你的节奏" : "min · at your pace"}`
        : zh
          ? "制定你的训练计划"
          : "Create your training plan",
      Icon: Dumbbell,
      page: "training" as Page,
    },
    {
      key: "sleep",
      time: "23:00",
      title: zh ? "为明天留足休息" : "Rest for tomorrow",
      desc: zh ? "放下屏幕，早点休息" : "Wind down and put screens away",
      Icon: Moon,
      page: "sleep" as Page,
    },
  ];
  async function toggle(key: string) {
    try {
      await save({
        ...state,
        completedActions: {
          ...state.completedActions,
          [today]: done.includes(key)
            ? done.filter((x) => x !== key)
            : [...done, key],
        },
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err));
    }
  }
  return (
    <>
      <div className={`mode-strip ${demo ? "demo" : ""}`}>
        <span>
          <Info size={19} />
          {demo
            ? zh
              ? "演示数据 · 体验完整流程"
              : "Demo data · explore the full flow"
            : zh
              ? "你的真实记录 · 每一步都由你决定"
              : "Your real records · you are in control"}
        </span>
        <button
          className="btn btn-primary"
          onClick={demo ? onCreate : () => navigate("plan")}
        >
          {demo
            ? zh
              ? "创建我的计划"
              : "Create my plan"
            : zh
              ? "查看我的计划"
              : "My plan"}
          <ArrowRight size={17} />
        </button>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <section className="hero-plan">
            <div>
              <h2>
                {zh ? (
                  <>
                    今天，
                    <span className="hero-title-cont">保持你的节奏。</span>
                  </>
                ) : (
                  "Find your rhythm today."
                )}
              </h2>
              <p>
                {zh
                  ? "训练、饮食与休息，一起向前。"
                  : "Training, nutrition and rest. Moving together."}
              </p>
              <button
                className="btn btn-primary"
                onClick={() => navigate("plan")}
              >
                {zh ? "查看今日计划" : "View today’s plan"}
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="progress-ring">
              <svg viewBox="0 0 160 160" aria-hidden="true">
                <circle className="ring-track" cx="80" cy="80" r="66" />
                <circle
                  className="ring-value"
                  cx="80"
                  cy="80"
                  r="66"
                  strokeDasharray={`${(Math.min(done.length, 3) / 3) * 414.69} 414.69`}
                />
              </svg>
              <div>
                <strong>
                  {Math.min(done.length, 3)} <small>/ 3</small>
                </strong>
                <span>{zh ? "今日行动" : "Daily actions"}</span>
              </div>
            </div>
          </section>
          <div className="metric-grid">
            {[
              {
                label: zh ? "饮食摄入" : "Nutrition logged",
                value: meals.length ? kcals.toLocaleString() : "—",
                unit: "kcal",
                Icon: Utensils,
                button: zh ? "查看饮食" : "View nutrition",
                page: "nutrition" as Page,
              },
              {
                label: zh ? "训练时间" : "Training time",
                value: workouts.length ? String(duration) : "—",
                unit: "min",
                Icon: Dumbbell,
                button: zh ? "记录训练" : "Log training",
                page: "training" as Page,
              },
              {
                label: zh ? "昨晚睡眠" : "Last night’s sleep",
                value:
                  minutes === null
                    ? "—"
                    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
                unit: "",
                Icon: Moon,
                button: zh ? "查看睡眠" : "View sleep",
                page: "sleep" as Page,
              },
            ].map((m) => (
              <section key={m.page} className="metric">
                <div className="metric-label">
                  <m.Icon size={23} />
                  <span>{m.label}</span>
                  <button
                    className="icon-button"
                    aria-label={m.button}
                    onClick={() => navigate(m.page)}
                  >
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="metric-value">
                  {m.value}
                  <span>{m.unit}</span>
                </div>
                <button
                  className="btn btn-tint"
                  onClick={() => navigate(m.page)}
                >
                  {m.button}
                  <ArrowRight size={16} />
                </button>
              </section>
            ))}
          </div>
          <section className="panel schedule">
            <div className="section-heading">
              <h2>{zh ? "今日安排" : "Today’s rhythm"}</h2>
              <button className="text-button" onClick={() => navigate("plan")}>
                {zh ? "查看全部" : "View all"}
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="timeline">
              {actions.map((a) => (
                <div className="timeline-row" key={a.key}>
                  <time>{a.time}</time>
                  <button
                    className={`action-check ${done.includes(a.key) ? "checked" : ""}`}
                    onClick={() => toggle(a.key)}
                    aria-pressed={done.includes(a.key)}
                    aria-label={`${a.title} ${zh ? "完成状态" : "completion"}`}
                  >
                    {done.includes(a.key) && <Check size={13} />}
                  </button>
                  <a.Icon className="timeline-icon" size={23} />
                  <button
                    className="timeline-content"
                    onClick={() => navigate(a.page)}
                  >
                    <strong>{a.title}</strong>
                    <span>{a.desc}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="panel latest-meal">
            <div className="section-heading">
              <h2>{zh ? "最近饮食" : "Recent nutrition"}</h2>
              <button
                className="text-button"
                onClick={() => navigate("nutrition")}
              >
                {zh ? "查看全部" : "View all"}
                <ArrowRight size={16} />
              </button>
            </div>
            {latest ? (
              <div className="meal-preview">
                {demo || latest.assetId ? (
                  <img
                    src={
                      latest.assetId
                        ? assetUrl(latest.assetId)
                        : "/demo-meal.png"
                    }
                    alt={zh ? "已记录的食物" : "Logged meal"}
                  />
                ) : (
                  <div className="meal-placeholder">
                    <Utensils size={32} />
                  </div>
                )}
                <div>
                  <h3>{demo && !zh ? "Chicken & grain bowl" : latest.name}</h3>
                  <p className="muted">
                    {zh ? "份量已确认" : "Portion confirmed"} · {latest.grams} g
                  </p>
                  <strong>
                    {mealTotals(latest).kcal}{" "}
                    <span className="muted">kcal</span>
                  </strong>
                </div>
                <button
                  className="icon-button"
                  onClick={() => navigate("nutrition")}
                  aria-label={zh ? "查看饮食" : "View nutrition"}
                >
                  <ArrowRight size={21} />
                </button>
              </div>
            ) : (
              <div className="empty-state compact">
                <Utensils size={26} />
                <p>
                  {zh
                    ? "从记录你的第一餐开始。"
                    : "Start with your first meal."}
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate("nutrition")}
                >
                  {zh ? "记录饮食" : "Log a meal"}
                </button>
              </div>
            )}
          </section>
        </div>
        <aside className="dashboard-rail">
          <section className="panel week-panel">
            <div className="section-heading">
              <h2>{zh ? "本周节奏" : "Weekly rhythm"}</h2>
              <span className="muted">
                {zh ? "训练分钟" : "Training minutes"}
              </span>
            </div>
            <div className="bar-chart">
              {week.map((day) => {
                const w = state.workouts.filter((x) => x.date === day.date);
                const value = w.length
                  ? w.reduce((sum, x) => sum + x.duration, 0)
                  : null;
                return (
                  <button
                    key={day.date}
                    className="bar-column"
                    onClick={() => navigate("trends")}
                    aria-label={`${day.date}: ${value === null ? (zh ? "无记录" : "Not logged") : `${value} min`}`}
                  >
                    <span className="bar-value">{value ?? "—"}</span>
                    <div className="bar-slot">
                      <span
                        className={day.date === today ? "bar today-bar" : "bar"}
                        style={{
                          height:
                            value === null
                              ? 4
                              : Math.max(8, Math.min((value / 60) * 100, 100)) +
                                "%",
                        }}
                      />
                    </div>
                    <span className="bar-label">{day.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="week-summary">
              <div>
                <strong>{weekWorkouts.length}</strong>
                <span>{zh ? " 次训练" : " workouts"}</span>
                <p>{zh ? "本周已完成" : "Logged this week"}</p>
              </div>
              <div>
                <strong>{mealDays}</strong>
                <span>{zh ? " 天有饮食记录" : " food days"}</span>
                <p>{zh ? "共 7 天" : "Out of 7 days"}</p>
              </div>
            </div>
          </section>
          <section className="panel suggestion-panel">
            <span className="icon-surface">
              <SlidersHorizontal size={22} />
            </span>
            <h2>{zh ? "让计划跟着你调整" : "A plan that moves with you"}</h2>
            <p>
              {zh
                ? "时间有限？把每次训练调整为 30 分钟。"
                : "Short on time? Adjust your training sessions to 30 minutes."}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("plan")}
            >
              {zh ? "查看调整" : "Review adjustment"}
              <ArrowRight size={17} />
            </button>
            <p className="small muted">
              {zh ? "由你确认，随时撤销" : "Your choice. Easy to undo."}
            </p>
          </section>
          <div className="source-note">
            <Info size={15} />
            <span>
              {zh
                ? "记录反映已填写的数据，缺失不等于零。"
                : "Figures reflect your logs. Missing is not zero."}
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
