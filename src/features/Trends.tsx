import { useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronRight,
  Moon,
  Utensils,
} from "lucide-react";
import { mealTotals, sleepHours } from "../types";
import type { FeatureProps, Meal, Sleep, Workout } from "../types";

const copy = {
  zh: {
    title: "进步，从看见节奏开始。",
    subtitle: "饮食、训练与睡眠放在一起看，空白也有自己的含义。",
    week: "最近 7 天",
    fortnight: "最近 14 天",
    nutrition: "记录的饮食能量",
    training: "训练时间",
    sleep: "记录的睡眠",
    calorieUnit: "kcal",
    minuteUnit: "分钟",
    hourUnit: "小时",
    chartTitle: "日趋势",
    chartHelp: "点击日期查看数值、记录数与来源。缺少记录显示为 —，不会填成 0。",
    noMetricData: "这个时间段还没有相关记录。先记录一次，就能在这里看见它。",
    noData: "未记录",
    logged: "有记录",
    selected: "所选日期",
    recordedNutrition: "饮食有记录",
    recordedTraining: "训练有记录",
    recordedSleep: "睡眠有记录",
    days: "天",
    of: "/",
    coverageTitle: "记录覆盖",
    coverageHelp:
      "指这段时间里有记录的日期，不代表你记录了全部饮食、活动或睡眠，也不是健康分数。",
    allThree: "三类均有记录",
    dayDetail: "这一天的记录",
    source: "来源",
    manualSource: "手动录入与用户审核的标签数值",
    sleepSource: "手动睡眠记录，按醒来日归属",
    estimateSource: "包含估算记录；数值应结合份量审核理解",
    workoutSource: "你保存的训练完成记录",
    missingHelp: "未记录不代表没有进食、没有活动或没有睡眠。",
    sleepHelp:
      "同一天的重叠睡眠区间合并计算，避免重复计时；主观精力与感受分别保留。",
    reviewTitle: "把本周变成下一步。",
    reviewSubtitle: "根据这段时间实际保存的记录整理，没有调用 AI。",
    averageSleep: "已记录日期的平均睡眠",
    totalTraining: "已记录训练总时间",
    mealCount: "保存的饮食记录",
    mealOne: "条",
    mealMany: "条",
    workoutOne: "次训练",
    workoutMany: "次训练",
    sleepOne: "条睡眠记录",
    sleepMany: "条睡眠记录",
    completeAction: "下一步：保持记录，并在计划页选择一个适合下周的小调整。",
    incompleteAction:
      "下一步：选择最容易坚持的一项记录。先补足背景，再判断是否需要调整计划。",
    relationHelp:
      "这些趋势帮助你发现变化。它们不能证明饮食、训练与睡眠之间的因果关系。",
    period: "统计区间",
    chartLabel: "日趋势图，可用 Tab 选择日期，按回车查看详情",
  },
  en: {
    title: "See the rhythm behind your progress.",
    subtitle:
      "View meals, training and sleep together. A gap is meaningful too.",
    week: "Last 7 days",
    fortnight: "Last 14 days",
    nutrition: "Recorded food energy",
    training: "Training time",
    sleep: "Recorded sleep",
    calorieUnit: "kcal",
    minuteUnit: "min",
    hourUnit: "hours",
    chartTitle: "Daily trends",
    chartHelp:
      "Select a date to see values, record counts and sources. Missing records show — and are never filled with 0.",
    noMetricData:
      "There are no related records in this period. Save one record to see it here.",
    noData: "Not recorded",
    logged: "Recorded",
    selected: "Selected date",
    recordedNutrition: "Days with food records",
    recordedTraining: "Days with training records",
    recordedSleep: "Days with sleep records",
    days: "days",
    of: "of",
    coverageTitle: "Record coverage",
    coverageHelp:
      "This counts dates with records. It does not mean all meals, activity or sleep were recorded, and it is not a health score.",
    allThree: "Days with all three categories",
    dayDetail: "Records for this date",
    source: "Source",
    manualSource: "Manual entries and label values reviewed by you",
    sleepSource: "Manual sleep entries, assigned to the wake-up date",
    estimateSource:
      "Includes estimates; review them with the portion sizes in mind",
    workoutSource: "Training completion records you saved",
    missingHelp:
      "A missing record does not mean you did not eat, move or sleep.",
    sleepHelp:
      "Overlapping sleep intervals for the same day are merged to avoid counting time twice. Energy and how you felt remain separate records.",
    reviewTitle: "Turn this week into a next step.",
    reviewSubtitle:
      "Based on actual records saved for this period. No AI is being called.",
    averageSleep: "Average sleep on recorded dates",
    totalTraining: "Total recorded training time",
    mealCount: "Saved food records",
    mealOne: "record",
    mealMany: "records",
    workoutOne: "training session",
    workoutMany: "training sessions",
    sleepOne: "sleep record",
    sleepMany: "sleep records",
    completeAction:
      "Next step: keep recording and choose one manageable adjustment for next week on the Plan page.",
    incompleteAction:
      "Next step: choose one record you can keep up with. Add context before deciding whether to change your plan.",
    relationHelp:
      "These trends can help you notice changes. They do not establish cause and effect between food, training and sleep.",
    period: "Period",
    chartLabel:
      "Daily trend chart. Use Tab to select a date and Enter to inspect it.",
  },
};
type Metric = "nutrition" | "training" | "sleep";
interface DayData {
  date: string;
  meals: Meal[];
  workouts: Workout[];
  sleeps: Sleep[];
  nutrition: number | null;
  training: number | null;
  sleep: number | null;
}

function sleepDuration(records: Sleep[]): number | null {
  const intervals = records
    .filter((s) => Number.isFinite(sleepHours(s)) && sleepHours(s) > 0)
    .map(
      (s) =>
        [new Date(s.start).getTime(), new Date(s.end).getTime()] as [
          number,
          number,
        ],
    )
    .sort((a, b) => a[0] - b[0]);
  if (!intervals.length) return null;
  let [start, end] = intervals[0];
  let total = 0;
  for (const interval of intervals.slice(1)) {
    if (interval[0] <= end) end = Math.max(end, interval[1]);
    else {
      total += end - start;
      [start, end] = interval;
    }
  }
  return (total + end - start) / 3600000;
}
function datesEndingAt(last: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(`${last}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - count + 1 + index);
    return d.toISOString().slice(0, 10);
  });
}

export function Trends({ state, lang, onOpenTrainingStatistics }: FeatureProps & { onOpenTrainingStatistics?: () => void }) {
  const c = copy[lang];
  const [range, setRange] = useState<7 | 14>(7);
  const [metric, setMetric] = useState<Metric>("nutrition");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone:
      state.profile?.timezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const data = useMemo(() => {
    const meals = new Map<string, Meal[]>(),
      workouts = new Map<string, Workout[]>(),
      sleeps = new Map<string, Sleep[]>();
    for (const meal of state.meals)
      meals.set(meal.date, [...(meals.get(meal.date) ?? []), meal]);
    for (const workout of state.workouts)
      workouts.set(workout.date, [
        ...(workouts.get(workout.date) ?? []),
        workout,
      ]);
    for (const sleep of state.sleeps)
      sleeps.set(sleep.date, [...(sleeps.get(sleep.date) ?? []), sleep]);
    return datesEndingAt(today, range).map((date) => {
      const m = meals.get(date) ?? [],
        w = workouts.get(date) ?? [],
        s = sleeps.get(date) ?? [];
      return {
        date,
        meals: m,
        workouts: w,
        sleeps: s,
        nutrition: m.length
          ? m.reduce((total, record) => total + mealTotals(record).kcal, 0)
          : null,
        training: w.length
          ? w.reduce((total, record) => total + record.duration, 0)
          : null,
        sleep: sleepDuration(s),
      } satisfies DayData;
    });
  }, [state.meals, state.workouts, state.sleeps, today, range]);
  const selected =
    data.find((day) => day.date === selectedDate) ?? data[data.length - 1];
  const number = (value: number, precision = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: precision }).format(
      value,
    );
  const dateLabel = (value: string, short = false) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      month: short ? "numeric" : "short",
      day: "numeric",
      ...(short ? {} : { weekday: "short" as const }),
    }).format(new Date(`${value}T12:00:00.000Z`));
  const unit = (value: Metric) =>
    value === "nutrition"
      ? c.calorieUnit
      : value === "training"
        ? c.minuteUnit
        : c.hourUnit;
  const display = (value: number | null, kind: Metric) =>
    value === null
      ? "—"
      : `${number(value, kind === "sleep" ? 1 : 0)} ${unit(kind)}`;
  const counts = {
    nutrition: data.filter((d) => d.nutrition !== null).length,
    training: data.filter((d) => d.training !== null).length,
    sleep: data.filter((d) => d.sleep !== null).length,
  };
  const complete = data.filter(
    (d) => d.nutrition !== null && d.training !== null && d.sleep !== null,
  ).length;
  const sleepDays = data.filter((d) => d.sleep !== null);
  const averageSleep = sleepDays.length
    ? sleepDays.reduce((total, d) => total + d.sleep!, 0) / sleepDays.length
    : null;
  const totalTraining = counts.training
    ? data.reduce((total, d) => total + (d.training ?? 0), 0)
    : null;
  const mealCount = data.reduce((total, d) => total + d.meals.length, 0);
  const values = data.map((d) => d[metric]);
  const known = values.filter((value): value is number => value !== null);
  const maximum = Math.max(1, ...known) * 1.15;
  const width = 760,
    height = 255,
    left = 52,
    right = 20,
    top = 24,
    bottom = 47;
  const x = (i: number) =>
    left + (i * (width - left - right)) / (data.length - 1);
  const y = (value: number) =>
    height - bottom - (value / maximum) * (height - top - bottom);
  const segments: number[][] = [];
  values.forEach((value, i) => {
    if (value === null) return;
    if (i === 0 || values[i - 1] === null) segments.push([]);
    segments[segments.length - 1].push(i);
  });
  const color =
    metric === "nutrition"
      ? "#709c37"
      : metric === "training"
        ? "#283339"
        : "#807ba3";
  const describe = (d: DayData) =>
    `${dateLabel(d.date)}: ${c[metric]} ${display(d[metric], metric)}${d[metric] === null ? `, ${c.noData}` : ""}`;

  return (
    <div className="stack">
      <header className="page-heading">
        <div>
          <h1>{c.title}</h1>
          <p className="page-subtitle">{c.subtitle}</p>
        </div>
        <div className="segmented" aria-label={c.period}>
          {([7, 14] as const).map((count) => (
            <button
              type="button"
              className={range === count ? "active" : ""}
              aria-pressed={range === count}
              key={count}
              onClick={() => setRange(count)}
            >
              {count === 7 ? c.week : c.fortnight}
            </button>
          ))}
        </div>
      </header>
      {onOpenTrainingStatistics ? <div className="row-actions"><button type="button" className="btn btn-secondary" onClick={onOpenTrainingStatistics}><Activity size={17} />{lang === "zh" ? "查看训练统计" : "View training statistics"}</button><span className="hint">{lang === "zh" ? "活动热图、肌群训练量、体重与动作进步" : "Activity, muscle volume, body weight and exercise progress"}</span></div> : null}
      <div className="form-grid three">
        {(
          [
            ["nutrition", c.recordedNutrition, Utensils],
            ["training", c.recordedTraining, Activity],
            ["sleep", c.recordedSleep, Moon],
          ] as const
        ).map(([kind, title, Icon]) => (
          <section className="panel" key={kind}>
            <div
              className="row-actions"
              style={{ justifyContent: "space-between" }}
            >
              <span className="muted">{title}</span>
              <Icon size={18} aria-hidden="true" />
            </div>
            <p className="stat-value">
              {number(counts[kind])}
              <span className="muted" style={{ fontSize: 14, marginLeft: 8 }}>
                {c.of} {range} {c.days}
              </span>
            </p>
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="page-heading">
          <div>
            <h2 className="section-title">{c.chartTitle}</h2>
            <p className="hint">{c.chartHelp}</p>
          </div>
          <div className="segmented" aria-label={c.chartTitle}>
            {(["nutrition", "training", "sleep"] as const).map((kind) => (
              <button
                type="button"
                key={kind}
                className={metric === kind ? "active" : ""}
                aria-pressed={metric === kind}
                onClick={() => setMetric(kind)}
              >
                {c[kind]}
              </button>
            ))}
          </div>
        </div>
        {known.length ? (
          <div style={{ marginTop: 14 }}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="group"
              aria-label={c.chartLabel}
              style={{ width: "100%", display: "block", overflow: "visible" }}
            >
              {[0, 0.5, 1].map((factor) => (
                <g key={factor}>
                  <line
                    x1={left}
                    x2={width - right}
                    y1={y(maximum * factor)}
                    y2={y(maximum * factor)}
                    stroke="#e8ebee"
                    strokeDasharray={factor ? "4 4" : undefined}
                  />
                  <text
                    x={left - 10}
                    y={y(maximum * factor) + 4}
                    textAnchor="end"
                    fill="#737985"
                    fontSize={11}
                  >
                    {number(maximum * factor, metric === "sleep" ? 1 : 0)}
                  </text>
                </g>
              ))}
              {segments.map((segment, i) => (
                <polyline
                  key={i}
                  points={segment
                    .map((index) => `${x(index)},${y(values[index]!)}`)
                    .join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {data.map((day, i) => (
                <g
                  key={day.date}
                  role="button"
                  tabIndex={0}
                  aria-label={describe(day)}
                  aria-pressed={selected.date === day.date}
                  onClick={() => setSelectedDate(day.date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDate(day.date);
                    }
                  }}
                  style={{ cursor: "pointer", outlineOffset: 3 }}
                >
                  <title>{describe(day)}</title>
                  <rect
                    x={x(i) - 18}
                    y={top}
                    width={36}
                    height={height - top - bottom}
                    fill={
                      selected.date === day.date ? "#eff5e8" : "transparent"
                    }
                    rx={8}
                  />
                  {day[metric] !== null ? (
                    <circle
                      cx={x(i)}
                      cy={y(day[metric]!)}
                      r={selected.date === day.date ? 7 : 4}
                      fill={color}
                      stroke="white"
                      strokeWidth={2}
                    />
                  ) : (
                    <text
                      x={x(i)}
                      y={(top + height - bottom) / 2}
                      fill="#b4bac0"
                      textAnchor="middle"
                      fontSize={16}
                    >
                      —
                    </text>
                  )}
                  <text
                    x={x(i)}
                    y={height - 18}
                    textAnchor="middle"
                    fill={selected.date === day.date ? "#171b20" : "#737985"}
                    fontSize={11}
                  >
                    {range === 7 || i % 2 === 0 || i === data.length - 1
                      ? dateLabel(day.date, true)
                      : ""}
                  </text>
                </g>
              ))}
            </svg>
            <p className="hint">
              {dateLabel(data[0].date)} –{" "}
              {dateLabel(data[data.length - 1].date)} · {unit(metric)} · —{" "}
              {c.noData}
            </p>
          </div>
        ) : (
          <div className="empty-state" style={{ minHeight: 190 }}>
            <CalendarDays size={30} />
            <p>{c.noMetricData}</p>
          </div>
        )}
        <div
          className="panel"
          style={{ background: "#f7f8fa", marginTop: 10 }}
          aria-live="polite"
        >
          <div
            className="row-actions"
            style={{ justifyContent: "space-between" }}
          >
            <div>
              <span className="muted">{c.selected}</span>
              <h3 className="section-title" style={{ marginTop: 8 }}>
                {dateLabel(selected.date)}
              </h3>
            </div>
            <span className="stat-value" style={{ fontSize: 26 }}>
              {display(selected[metric], metric)}
            </span>
          </div>
          <div className="form-grid three" style={{ marginTop: 12 }}>
            {(["nutrition", "training", "sleep"] as const).map((kind) => (
              <div key={kind}>
                <span className="muted">{c[kind]}</span>
                <p>
                  <strong>{display(selected[kind], kind)}</strong>
                </p>
              </div>
            ))}
          </div>
          <p className="hint">
            {c.source}:{" "}
            {metric === "nutrition"
              ? selected.meals.some((m) => m.source === "ai_estimate")
                ? c.estimateSource
                : c.manualSource
              : metric === "training"
                ? c.workoutSource
                : c.sleepSource}
          </p>
          {selected[metric] === null && <p className="hint">{c.missingHelp}</p>}
        </div>
      </section>
      <div className="form-grid">
        <section className="panel">
          <h2 className="section-title">{c.coverageTitle}</h2>
          <p className="stat-value">
            {number(complete)}
            <span className="muted" style={{ fontSize: 14, marginLeft: 8 }}>
              {c.of} {range} {c.days}
            </span>
          </p>
          <p className="hint">{c.allThree}</p>
          <p className="hint">{c.coverageHelp}</p>
        </section>
        <section className="panel">
          <h2 className="section-title">{c.dayDetail}</h2>
          <div className="record-row">
            <div className="row-main">
              <strong>{dateLabel(selected.date)}</strong>
              <span className="muted">
                {number(selected.meals.length)}{" "}
                {selected.meals.length === 1 ? c.mealOne : c.mealMany} ·{" "}
                {number(selected.workouts.length)}{" "}
                {selected.workouts.length === 1 ? c.workoutOne : c.workoutMany}{" "}
                · {number(selected.sleeps.length)}{" "}
                {selected.sleeps.length === 1 ? c.sleepOne : c.sleepMany}
              </span>
            </div>
            <ChevronRight size={18} aria-hidden="true" />
          </div>
          {selected.meals.length > 0 && (
            <p className="hint">
              {selected.meals.map((m) => m.name).join(" · ")}
            </p>
          )}
          {selected.workouts.length > 0 && (
            <p className="hint">
              {selected.workouts.map((w) => w.name).join(" · ")}
            </p>
          )}
          <p className="hint">
            {selected.sleeps.length ? c.sleepHelp : c.missingHelp}
          </p>
        </section>
      </div>
      <section className="panel">
        <h2 className="section-title">{c.reviewTitle}</h2>
        <p className="hint">{c.reviewSubtitle}</p>
        <div className="form-grid three" style={{ marginTop: 22 }}>
          <div>
            <span className="muted">{c.averageSleep}</span>
            <p className="stat-value" style={{ fontSize: 27 }}>
              {display(averageSleep, "sleep")}
            </p>
          </div>
          <div>
            <span className="muted">{c.totalTraining}</span>
            <p className="stat-value" style={{ fontSize: 27 }}>
              {display(totalTraining, "training")}
            </p>
          </div>
          <div>
            <span className="muted">{c.mealCount}</span>
            <p className="stat-value" style={{ fontSize: 27 }}>
              {number(mealCount)}
            </p>
          </div>
        </div>
        <p>{complete === range ? c.completeAction : c.incompleteAction}</p>
        <p className="hint">{c.relationHelp}</p>
      </section>
    </div>
  );
}

export default Trends;
