import { useState, type FormEvent } from "react";
import { Clock3, Moon, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import { Modal } from "../components/Modal";
import {
  localDate,
  sleepHours,
  uid,
  type FeatureProps,
  type Sleep as SleepEntry,
} from "../types";

type SleepDraft = {
  id?: string;
  start: string;
  end: string;
  quality: string;
  energy: string;
  timezone: string;
  createdAt?: string;
};
const browserTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC";
const toInput = (instant: string) => {
  const date = new Date(instant);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
};
const wakeDate = (instant: Date, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
const clockHour = (instant: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  return (
    Number(parts.find((part) => part.type === "hour")?.value ?? 0) +
    Number(parts.find((part) => part.type === "minute")?.value ?? 0) / 60
  );
};

export default function Sleep({ state, lang, save, notify }: FeatureProps) {
  const zh = lang === "zh";
  const [date, setDate] = useState(localDate);
  const [draft, setDraft] = useState<SleepDraft | null>(null);
  const [deleting, setDeleting] = useState<SleepEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const records = state.sleeps
    .filter((sleep) => sleep.date === date)
    .sort((a, b) => b.start.localeCompare(a.start));
  const hours = records.reduce((sum, sleep) => sum + sleepHours(sleep), 0);
  const latest = records[0];
  const formatTime = (instant: string, timezone: string) =>
    new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(instant));
  const rating = (value: number, kind: "quality" | "energy") => {
    const labels =
      kind === "quality"
        ? zh
          ? ["很差", "较差", "一般", "良好", "很好"]
          : ["Very poor", "Poor", "Okay", "Good", "Very good"]
        : zh
          ? ["很疲惫", "较疲惫", "一般", "有精神", "很充沛"]
          : ["Very tired", "Tired", "Okay", "Energized", "Very energized"];
    return value + " · " + labels[value - 1];
  };
  const open = (sleep?: SleepEntry) => {
    setError("");
    setDraft(
      sleep
        ? {
            id: sleep.id,
            start: toInput(sleep.start),
            end: toInput(sleep.end),
            quality: String(sleep.quality),
            energy: String(sleep.energy),
            timezone: sleep.timezone,
            createdAt: sleep.createdAt,
          }
        : {
            start: "",
            end: "",
            quality: "",
            energy: "",
            timezone: browserTimezone,
          },
    );
  };
  const close = () => {
    if (!busy) {
      setDraft(null);
      setError("");
    }
  };
  const patch = (change: Partial<SleepDraft>) =>
    setDraft((current) => (current ? { ...current, ...change } : null));
  const startDate = draft?.start ? new Date(draft.start) : null;
  const endDate = draft?.end ? new Date(draft.end) : null;
  const draftHours =
    startDate && endDate
      ? (endDate.getTime() - startDate.getTime()) / 3600000
      : null;
  const validDuration =
    draftHours !== null &&
    Number.isFinite(draftHours) &&
    draftHours > 0 &&
    draftHours <= 24;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || busy) return;
    setError("");
    const start = new Date(draft.start),
      end = new Date(draft.end);
    const duration = end.getTime() - start.getTime();
    const quality = Number(draft.quality),
      energy = Number(draft.energy);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      duration <= 0 ||
      duration > 24 * 3600000
    ) {
      setError(
        zh
          ? "醒来时间须晚于开始时间，单次时长须大于 0 且不超过 24 小时。跨午夜时请选择次日日期。"
          : "Wake-up must follow the start, with a duration over 0 and at most 24 hours. Choose the next date for overnight sleep.",
      );
      return;
    }
    if (
      toInput(start.toISOString()) !== draft.start ||
      toInput(end.toISOString()) !== draft.end
    ) {
      setError(
        zh
          ? "这个本机时间可能位于夏令时跳时区间，请核对后重选。"
          : "This local time may fall in a daylight-saving gap. Check and choose the time again.",
      );
      return;
    }
    if (
      ![quality, energy].every(
        (value) => Number.isInteger(value) && value >= 1 && value <= 5,
      )
    ) {
      setError(
        zh
          ? "请选择 1–5 的睡眠感受和醒来精力。"
          : "Choose sleep quality and waking energy from 1–5.",
      );
      return;
    }
    if (
      state.sleeps.some(
        (sleep) =>
          sleep.id !== draft.id &&
          start.getTime() < Date.parse(sleep.end) &&
          end.getTime() > Date.parse(sleep.start),
      )
    ) {
      setError(
        zh
          ? "这段时间与已有睡眠记录重叠，请调整时间或编辑原记录。"
          : "This interval overlaps an existing sleep record. Adjust the times or edit that record.",
      );
      return;
    }
    setBusy(true);
    try {
      const sleep: SleepEntry = {
        id: draft.id ?? uid(),
        date: wakeDate(end, draft.timezone),
        start: start.toISOString(),
        end: end.toISOString(),
        quality,
        energy,
        source: "manual",
        timezone: draft.timezone,
        createdAt: draft.createdAt ?? new Date().toISOString(),
      };
      await save({
        ...state,
        sleeps: draft.id
          ? state.sleeps.map((item) => (item.id === sleep.id ? sleep : item))
          : [...state.sleeps, sleep],
      });
      setDate(sleep.date);
      setDraft(null);
      notify("睡眠记录已保存", "Sleep saved");
    } catch (cause) {
      setError(
        (zh ? "保存失败：" : "Could not save: ") +
          (cause instanceof Error
            ? cause.message
            : zh
              ? "请重试。"
              : "Please try again."),
      );
      notify("睡眠未保存，请重试", "Sleep was not saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    setError("");
    try {
      await save({
        ...state,
        sleeps: state.sleeps.filter((sleep) => sleep.id !== deleting.id),
      });
      setDeleting(null);
      notify("睡眠记录已删除", "Sleep deleted");
    } catch (cause) {
      setError(
        (zh ? "删除失败：" : "Could not delete: ") +
          (cause instanceof Error
            ? cause.message
            : zh
              ? "请重试。"
              : "Please try again."),
      );
      notify("未能删除睡眠记录", "Could not delete sleep");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>{zh ? "睡眠" : "Sleep"}</h1>
          <p className="page-subtitle">
            {zh
              ? "记下休息，也记下醒来的感受。"
              : "Log your rest and how you felt waking up."}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => open()}>
          <Plus size={18} />
          {zh ? "记录睡眠" : "Log sleep"}
        </button>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>{zh ? "醒来这一天" : "Wake-up day"}</h2>
          <label className="field">
            <span className="muted">{zh ? "醒来日期" : "Wake-up date"}</span>
            <input
              className="input"
              type="date"
              value={date}
              onInput={(event) => setDate(event.currentTarget.value)}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
        <div className="form-grid three">
          <div>
            <span className="muted">{zh ? "记录时长" : "Logged duration"}</span>
            <div className="stat-value">
              {records.length ? Math.round(hours * 10) / 10 : "—"}{" "}
              <small>{zh ? "小时" : "h"}</small>
            </div>
          </div>
          <div>
            <span className="muted">
              {zh ? "最近一次睡眠感受" : "Latest sleep quality"}
            </span>
            <div className="stat-value">
              {latest ? latest.quality : "—"} <small>/ 5</small>
            </div>
          </div>
          <div>
            <span className="muted">
              {zh ? "最近一次醒来精力" : "Latest waking energy"}
            </span>
            <div className="stat-value">
              {latest ? latest.energy : "—"} <small>/ 5</small>
            </div>
          </div>
        </div>
        <p className="hint">
          {zh
            ? "时长根据手动填写的起止时间计算，不包含自动睡眠分期。"
            : "Duration comes from your manual start and end times. No sleep-stage detection is included."}
        </p>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>{zh ? "休息时间线" : "Rest timeline"}</h2>
          <span className="badge">{zh ? "手动记录" : "Manual records"}</span>
        </div>
        {records.length ? (
          records.map((sleep) => {
            const left = (clockHour(sleep.start, sleep.timezone) / 24) * 100;
            const width = (sleepHours(sleep) / 24) * 100;
            const firstWidth = Math.min(width, 100 - left);
            const remainingWidth = Math.max(0, width - firstWidth);
            return (
              <div
                key={sleep.id}
                className="stack"
                style={{
                  borderTop: "1px solid #e9ecf0",
                  paddingTop: 18,
                  paddingBottom: 18,
                }}
              >
                <div className="record-row">
                  <div className="row-main">
                    <strong>
                      {Math.round(sleepHours(sleep) * 10) / 10}{" "}
                      {zh ? "小时" : "hours"}
                    </strong>
                    <p className="muted">{sleep.timezone}</p>
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={zh ? "编辑这段睡眠" : "Edit this sleep"}
                      disabled={busy}
                      onClick={() => open(sleep)}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={zh ? "删除这段睡眠" : "Delete this sleep"}
                      disabled={busy}
                      onClick={() => {
                        setDeleting(sleep);
                        setError("");
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                <div className="record-row">
                  <div className="row-main">
                    <Moon size={17} /> {formatTime(sleep.start, sleep.timezone)}
                  </div>
                  <div>
                    <Sun size={17} /> {formatTime(sleep.end, sleep.timezone)}
                  </div>
                </div>
                <div
                  role="img"
                  aria-label={
                    (zh ? "睡眠区间：" : "Sleep interval: ") +
                    formatTime(sleep.start, sleep.timezone) +
                    " – " +
                    formatTime(sleep.end, sleep.timezone)
                  }
                  style={{
                    position: "relative",
                    height: 10,
                    background: "#edf0f3",
                    borderRadius: 6,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      inset: "0 auto 0 " + left + "%",
                      width: firstWidth + "%",
                      background: "#c5f467",
                      borderRadius: 6,
                    }}
                  />
                  {remainingWidth > 0 ? (
                    <span
                      style={{
                        position: "absolute",
                        inset: "0 auto 0 0",
                        width: remainingWidth + "%",
                        background: "#c5f467",
                        borderRadius: 6,
                      }}
                    />
                  ) : null}
                </div>
                <div className="record-row muted">
                  <span>00:00</span>
                  <span>12:00</span>
                  <span>24:00</span>
                </div>
                <p className="muted">
                  {zh ? "睡眠感受：" : "Quality: "}
                  {rating(sleep.quality, "quality")} ·{" "}
                  {zh ? "醒来精力：" : "Waking energy: "}
                  {rating(sleep.energy, "energy")}
                </p>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <Moon size={32} />
            <h3>{zh ? "还没有这一天的睡眠记录" : "No sleep on this date"}</h3>
            <p>
              {zh
                ? "选择实际开始与醒来的日期和时间。跨午夜的睡眠归入醒来当天。"
                : "Choose the actual start and wake-up dates and times. Overnight sleep belongs to the wake-up day."}
            </p>
            <button className="btn btn-secondary" onClick={() => open()}>
              {zh ? "添加睡眠记录" : "Add sleep"}
            </button>
          </div>
        )}
      </div>
      <p className="hint">
        <Clock3 size={17} />
        {zh
          ? "Apple Health / HealthKit 待 iPhone App 接入；网页目前采用手动记录。"
          : "Apple Health / HealthKit will require the iPhone app. This website currently uses manual records."}
      </p>
      {draft ? (
        <Modal
          title={
            draft.id
              ? zh
                ? "编辑睡眠"
                : "Edit sleep"
              : zh
                ? "记录睡眠"
                : "Log sleep"
          }
          description={
            zh
              ? "跨午夜时，醒来日期选择次日。"
              : "For overnight sleep, choose the next date for wake-up."
          }
          onClose={close}
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={close}
              >
                {zh ? "取消" : "Cancel"}
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                form="sleep-form"
                disabled={busy}
              >
                {busy
                  ? zh
                    ? "保存中…"
                    : "Saving…"
                  : zh
                    ? "保存睡眠"
                    : "Save sleep"}
              </button>
            </>
          }
        >
          <form id="sleep-form" className="stack" onSubmit={submit}>
            <fieldset
              disabled={busy}
              style={{ border: 0, margin: 0, padding: 0 }}
              className="stack"
            >
              <div className="form-grid">
                <label className="field">
                  {zh ? "开始日期与时间" : "Start date and time"}
                  <input
                    className="input"
                    type="datetime-local"
                    required
                    value={draft.start}
                    onInput={(event) =>
                      patch({ start: event.currentTarget.value })
                    }
                    onChange={(event) => patch({ start: event.target.value })}
                  />
                </label>
                <label className="field">
                  {zh ? "醒来日期与时间" : "Wake-up date and time"}
                  <input
                    className="input"
                    type="datetime-local"
                    required
                    value={draft.end}
                    onInput={(event) =>
                      patch({ end: event.currentTarget.value })
                    }
                    onChange={(event) => patch({ end: event.target.value })}
                  />
                </label>
              </div>
              <p className="hint">
                {zh
                  ? "时间按本机时区输入："
                  : "Enter times in your device time zone: "}
                {browserTimezone}
                {draft.timezone !== browserTimezone
                  ? (zh
                      ? "。此记录的日期归属仍按 "
                      : ". This record’s date still uses ") + draft.timezone
                  : ""}
              </p>
              <div className="panel">
                <strong>{zh ? "休息时长" : "Rest duration"}</strong>
                <div className="stat-value">
                  {validDuration ? Math.round(draftHours! * 100) / 100 : "—"}{" "}
                  <small>{zh ? "小时" : "h"}</small>
                </div>
                {validDuration && endDate ? (
                  <p className="muted">
                    {zh ? "归属醒来日期：" : "Wake-up day: "}
                    {wakeDate(endDate, draft.timezone)}
                  </p>
                ) : (
                  <p className="hint">
                    {zh
                      ? "单次记录须大于 0 且不超过 24 小时。"
                      : "Each record must be over 0 and at most 24 hours."}
                  </p>
                )}
              </div>
              <div className="form-grid">
                <label className="field">
                  {zh ? "睡眠感受（1–5）" : "Sleep quality (1–5)"}
                  <select
                    className="input"
                    required
                    value={draft.quality}
                    onChange={(event) => patch({ quality: event.target.value })}
                  >
                    <option value="">{zh ? "请选择" : "Choose"}</option>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option value={value} key={value}>
                        {rating(value, "quality")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  {zh ? "醒来精力（1–5）" : "Waking energy (1–5)"}
                  <select
                    className="input"
                    required
                    value={draft.energy}
                    onChange={(event) => patch({ energy: event.target.value })}
                  >
                    <option value="">{zh ? "请选择" : "Choose"}</option>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option value={value} key={value}>
                        {rating(value, "energy")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <span className="badge">
                {zh ? "来源：手动录入" : "Source: manual entry"}
              </span>
            </fieldset>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </Modal>
      ) : null}
      {deleting ? (
        <Modal
          title={zh ? "删除这段睡眠？" : "Delete this sleep?"}
          description={
            formatTime(deleting.start, deleting.timezone) +
            " – " +
            formatTime(deleting.end, deleting.timezone)
          }
          onClose={() => {
            if (!busy) {
              setDeleting(null);
              setError("");
            }
          }}
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  setDeleting(null);
                  setError("");
                }}
              >
                {zh ? "保留" : "Keep"}
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={remove}
              >
                {busy
                  ? zh
                    ? "删除中…"
                    : "Deleting…"
                  : zh
                    ? "删除记录"
                    : "Delete sleep"}
              </button>
            </>
          }
        >
          <p>
            {zh
              ? "删除后，这段睡眠不再计入休息与趋势。"
              : "This sleep will no longer count toward rest or trends."}
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
