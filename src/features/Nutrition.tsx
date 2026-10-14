import { useEffect, useState, type FormEvent } from "react";
import { Camera, Pencil, Plus, Trash2, Utensils } from "lucide-react";
import { assetUrl, request, uploadFile } from "../api";
import { Modal } from "../components/Modal";
import {
  localDate,
  mealTotals,
  uid,
  type FeatureProps,
  type Meal,
} from "../types";

type MealDraft = {
  id?: string;
  date: string;
  name: string;
  type: Meal["type"];
  grams: string;
  referenceGrams: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  source: "manual" | "label";
  assetId?: string;
  createdAt?: string;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const newDraft = (date: string): MealDraft => ({
  date,
  name: "",
  type: "lunch",
  grams: "100",
  referenceGrams: "100",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  source: "manual",
});

function Photo({
  file,
  assetId,
  name,
}: {
  file?: File;
  assetId?: string;
  name: string;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const url = file ? preview : assetId ? assetUrl(assetId) : "";
  return url ? (
    <img
      src={url}
      alt={name}
      loading="lazy"
      style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" }}
    />
  ) : null;
}

export default function Nutrition({
  state,
  lang,
  save,
  notify,
  demo,
}: FeatureProps) {
  const zh = lang === "zh";
  const [date, setDate] = useState(localDate);
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [demoPhotos, setDemoPhotos] = useState<Record<string, File>>({});
  const [deleting, setDeleting] = useState<Meal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meals = state.meals
    .filter((meal) => meal.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totals = meals.reduce(
    (total, meal) => {
      const value = mealTotals(meal);
      return {
        kcal: total.kcal + value.kcal,
        protein: total.protein + value.protein,
        carbs: total.carbs + value.carbs,
        fat: total.fat + value.fat,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const typeLabel = (type: Meal["type"]) =>
    ({
      breakfast: zh ? "早餐" : "Breakfast",
      lunch: zh ? "午餐" : "Lunch",
      dinner: zh ? "晚餐" : "Dinner",
      snack: zh ? "加餐" : "Snack",
    })[type];
  const sourceLabel = (source: Meal["source"]) =>
    source === "label"
      ? zh
        ? "包装标签"
        : "Nutrition label"
      : source === "ai_estimate"
        ? zh
          ? "AI 估算"
          : "AI estimate"
        : zh
          ? "手动录入"
          : "Manual";

  const discardUpload = async () => {
    if (!uploadedId || demo) return true;
    try {
      await request("/assets/" + encodeURIComponent(uploadedId), {
        method: "DELETE",
        body: "{}",
      });
      setUploadedId(null);
      return true;
    } catch (cause) {
      setError(
        (zh
          ? "未保存的照片清理失败，请重试关闭："
          : "Could not remove the unsaved photo. Try closing again: ") +
          (cause instanceof Error ? cause.message : ""),
      );
      notify(
        "未保存的照片暂未清理，请重试",
        "The unsaved photo could not be removed. Please retry.",
      );
      return false;
    }
  };
  const close = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await discardUpload()) {
        setDraft(null);
        setFile(null);
        setUploadedId(null);
        setError("");
      }
    } finally {
      setBusy(false);
    }
  };
  const open = (meal?: Meal) => {
    setError("");
    setUploadedId(null);
    setFile(meal ? (demoPhotos[meal.id] ?? null) : null);
    setDraft(
      meal
        ? {
            ...meal,
            grams: String(meal.grams),
            referenceGrams: String(meal.referenceGrams),
            kcal: String(meal.kcal),
            protein: String(meal.protein),
            carbs: String(meal.carbs),
            fat: String(meal.fat),
            source: meal.source === "label" ? "label" : "manual",
          }
        : newDraft(date),
    );
  };
  const patch = (change: Partial<MealDraft>) =>
    setDraft((current) => (current ? { ...current, ...change } : null));
  const chooseFile = async (selected?: File) => {
    setError("");
    if (!selected) return;
    if (
      !IMAGE_TYPES.includes(selected.type) ||
      selected.size > MAX_FILE_BYTES
    ) {
      setError(
        zh
          ? "请选择 5 MB 以内的 JPEG、PNG 或 WebP 图片。"
          : "Choose a JPEG, PNG or WebP image up to 5 MB.",
      );
      return;
    }
    setBusy(true);
    try {
      if (await discardUpload()) {
        setFile(selected);
        setUploadedId(null);
      }
    } finally {
      setBusy(false);
    }
  };
  const removePhoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await discardUpload()) {
        setFile(null);
        setUploadedId(null);
        patch({ assetId: undefined });
      }
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || busy) return;
    setError("");
    const numbers = [
      draft.grams,
      draft.referenceGrams,
      draft.kcal,
      draft.protein,
      draft.carbs,
      draft.fat,
    ].map(Number);
    const [grams, referenceGrams, kcal, protein, carbs, fat] = numbers;
    if (
      !draft.name.trim() ||
      !draft.date ||
      numbers.some((value) => !Number.isFinite(value)) ||
      grams <= 0 ||
      grams > 10000 ||
      referenceGrams <= 0 ||
      referenceGrams > 10000 ||
      kcal < 0 ||
      kcal > 100000 ||
      [protein, carbs, fat].some((value) => value < 0 || value > 10000) ||
      [draft.kcal, draft.protein, draft.carbs, draft.fat].some(
        (value) => !value.trim(),
      )
    ) {
      setError(
        zh
          ? "请填写名称、有效份量和完整的非负营养数值。"
          : "Enter a name, a valid portion and all non-negative nutrition values.",
      );
      return;
    }
    if (
      protein + carbs + fat > referenceGrams * 1.1 + 1 ||
      kcal > referenceGrams * 12
    ) {
      setError(
        zh
          ? "营养数值与标定重量不匹配，请核对每份或每 100 g 的基准。"
          : "Nutrition values do not match the reference weight. Check whether the label uses a serving or 100 g.",
      );
      return;
    }
    setBusy(true);
    try {
      let attachment = uploadedId ?? draft.assetId;
      if (file && !demo && !uploadedId) {
        const result = await uploadFile(file);
        attachment = result.id;
        setUploadedId(result.id);
      }
      const meal: Meal = {
        id: draft.id ?? uid(),
        name: draft.name.trim(),
        date: draft.date,
        type: draft.type,
        grams,
        referenceGrams,
        kcal,
        protein,
        carbs,
        fat,
        source: draft.source,
        ...(attachment ? { assetId: attachment } : {}),
        createdAt: draft.createdAt ?? new Date().toISOString(),
      };
      await save({
        ...state,
        meals: draft.id
          ? state.meals.map((item) => (item.id === meal.id ? meal : item))
          : [...state.meals, meal],
      });
      if (demo)
        setDemoPhotos((current) => {
          const next = { ...current };
          if (file) next[meal.id] = file;
          else delete next[meal.id];
          return next;
        });
      setDate(meal.date);
      setDraft(null);
      setFile(null);
      setUploadedId(null);
      notify("这餐已保存", "Meal saved");
    } catch (cause) {
      setError(
        (zh ? "保存失败：" : "Could not save: ") +
          (cause instanceof Error
            ? cause.message
            : zh
              ? "请重试。"
              : "Please try again."),
      );
      notify("这餐未保存，请重试", "Meal was not saved. Please try again.");
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
        meals: state.meals.filter((meal) => meal.id !== deleting.id),
      });
      setDemoPhotos((current) => {
        const next = { ...current };
        delete next[deleting.id];
        return next;
      });
      setDeleting(null);
      notify("饮食记录已删除", "Meal deleted");
    } catch (cause) {
      setError(
        (zh ? "删除失败：" : "Could not delete: ") +
          (cause instanceof Error
            ? cause.message
            : zh
              ? "请重试。"
              : "Please try again."),
      );
      notify("未能删除饮食记录", "Could not delete meal");
    } finally {
      setBusy(false);
    }
  };
  const previewValues =
    draft &&
    [
      draft.grams,
      draft.referenceGrams,
      draft.kcal,
      draft.protein,
      draft.carbs,
      draft.fat,
    ].every((value) => value.trim() && Number.isFinite(Number(value))) &&
    Number(draft.referenceGrams) > 0
      ? mealTotals({
          ...draft,
          grams: Number(draft.grams),
          referenceGrams: Number(draft.referenceGrams),
          kcal: Number(draft.kcal),
          protein: Number(draft.protein),
          carbs: Number(draft.carbs),
          fat: Number(draft.fat),
          id: draft.id ?? "",
          createdAt: draft.createdAt ?? "",
        })
      : null;

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>{zh ? "饮食" : "Nutrition"}</h1>
          <p className="page-subtitle">
            {zh
              ? "确认食物与份量，记下真实摄入。"
              : "Confirm your food and portion. Log what you ate."}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => open()}>
          <Plus size={18} />
          {zh ? "记录一餐" : "Log a meal"}
        </button>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>{zh ? "每日摄入" : "Daily intake"}</h2>
          <label className="field">
            <span className="muted">{zh ? "日期" : "Date"}</span>
            <input
              className="input"
              type="date"
              value={date}
              onInput={(event) => setDate(event.currentTarget.value)}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
        <div className="form-grid four">
          <div>
            <span className="muted">{zh ? "热量" : "Energy"}</span>
            <div className="stat-value">
              {meals.length ? totals.kcal : "—"} <small>kcal</small>
            </div>
          </div>
          <div>
            <span className="muted">{zh ? "蛋白质" : "Protein"}</span>
            <div className="stat-value">
              {meals.length ? Math.round(totals.protein * 10) / 10 : "—"}{" "}
              <small>g</small>
            </div>
          </div>
          <div>
            <span className="muted">{zh ? "碳水" : "Carbs"}</span>
            <div className="stat-value">
              {meals.length ? Math.round(totals.carbs * 10) / 10 : "—"}{" "}
              <small>g</small>
            </div>
          </div>
          <div>
            <span className="muted">{zh ? "脂肪" : "Fat"}</span>
            <div className="stat-value">
              {meals.length ? Math.round(totals.fat * 10) / 10 : "—"}{" "}
              <small>g</small>
            </div>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>{zh ? "饮食记录" : "Meal history"}</h2>
          <span className="muted">
            {meals.length} {zh ? "餐" : "meals"}
          </span>
        </div>
        {meals.length ? (
          meals.map((meal) => {
            const value = mealTotals(meal);
            return (
              <div className="record-row" key={meal.id}>
                <Photo
                  file={demoPhotos[meal.id]}
                  assetId={meal.assetId}
                  name={meal.name}
                />
                <div className="row-main">
                  <strong>{meal.name}</strong>
                  <p className="muted">
                    {typeLabel(meal.type)} · {meal.grams} g · {value.kcal} kcal
                  </p>
                  <p className="muted">
                    {zh ? "蛋白质" : "Protein"} {value.protein} g ·{" "}
                    {zh ? "碳水" : "Carbs"} {value.carbs} g ·{" "}
                    {zh ? "脂肪" : "Fat"} {value.fat} g
                  </p>
                  <span className="badge">{sourceLabel(meal.source)}</span>
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={(zh ? "编辑 " : "Edit ") + meal.name}
                    disabled={busy}
                    onClick={() => open(meal)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={(zh ? "删除 " : "Delete ") + meal.name}
                    disabled={busy}
                    onClick={() => {
                      setDeleting(meal);
                      setError("");
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <Utensils size={32} />
            <h3>{zh ? "这一天还没有饮食记录" : "No meals on this date"}</h3>
            <p>
              {zh
                ? "从一餐开始，份量和数值都可以之后修正。"
                : "Start with one meal. You can adjust the portion and values later."}
            </p>
            <button className="btn btn-secondary" onClick={() => open()}>
              {zh ? "添加第一餐" : "Add your first meal"}
            </button>
          </div>
        )}
      </div>
      <p className="hint">
        <Camera size={17} />
        {zh
          ? "照片识别尚未接入。你可以保存照片，并手动填写营养数值。"
          : "Photo recognition is not connected yet. Save a photo and enter nutrition manually."}
      </p>
      {draft ? (
        <Modal
          title={
            draft.id
              ? zh
                ? "编辑这一餐"
                : "Edit this meal"
              : zh
                ? "记录这一餐"
                : "Log this meal"
          }
          description={
            zh
              ? "营养按标定重量填写，摄入按实际重量计算。"
              : "Enter nutrition for the reference weight. Intake scales to the weight you ate."
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
                form="nutrition-form"
                disabled={busy}
              >
                {busy
                  ? zh
                    ? "保存中…"
                    : "Saving…"
                  : zh
                    ? "确认并保存"
                    : "Confirm and save"}
              </button>
            </>
          }
        >
          <form id="nutrition-form" className="stack" onSubmit={submit}>
            <fieldset
              disabled={busy}
              style={{ border: 0, padding: 0, margin: 0 }}
              className="stack"
            >
              <label className="field">
                {zh ? "食物名称" : "Meal name"}
                <input
                  className="input"
                  value={draft.name}
                  required
                  maxLength={160}
                  autoComplete="off"
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  {zh ? "日期" : "Date"}
                  <input
                    className="input"
                    type="date"
                    required
                    value={draft.date}
                    onInput={(event) =>
                      patch({ date: event.currentTarget.value })
                    }
                    onChange={(event) => patch({ date: event.target.value })}
                  />
                </label>
                <label className="field">
                  {zh ? "餐次" : "Meal"}
                  <select
                    className="input"
                    value={draft.type}
                    onChange={(event) =>
                      patch({ type: event.target.value as Meal["type"] })
                    }
                  >
                    {(["breakfast", "lunch", "dinner", "snack"] as const).map(
                      (type) => (
                        <option key={type} value={type}>
                          {typeLabel(type)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <label className="field">
                  {zh ? "实际吃了多少（克）" : "Weight eaten (g)"}
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    max="10000"
                    step="any"
                    required
                    value={draft.grams}
                    onChange={(event) => patch({ grams: event.target.value })}
                  />
                </label>
                <label className="field">
                  {zh ? "营养标定重量（克）" : "Nutrition reference weight (g)"}
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    max="10000"
                    step="any"
                    required
                    value={draft.referenceGrams}
                    onChange={(event) =>
                      patch({ referenceGrams: event.target.value })
                    }
                  />
                </label>
              </div>
              <div
                className="segmented"
                aria-label={
                  zh
                    ? "按标定份量选择"
                    : "Choose a portion of the reference weight"
                }
              >
                {[
                  { value: 0.5, zh: "半份", en: "Half" },
                  { value: 1, zh: "一份", en: "One" },
                  { value: 2, zh: "两份", en: "Double" },
                ].map((portion) => (
                  <button
                    type="button"
                    key={portion.value}
                    disabled={
                      !Number(draft.referenceGrams) ||
                      Number(draft.referenceGrams) <= 0
                    }
                    aria-pressed={
                      Number(draft.grams) ===
                      Number(draft.referenceGrams) * portion.value
                    }
                    onClick={() =>
                      patch({
                        grams: String(
                          Number(draft.referenceGrams) * portion.value,
                        ),
                      })
                    }
                  >
                    {zh ? portion.zh : portion.en}
                  </button>
                ))}
              </div>
              <p className="hint">
                {zh
                  ? "下方数值均对应标定重量，不是实际整餐。包装写每 100 g 时，标定重量填 100。"
                  : "The values below describe the reference weight, not the entire meal. If a label says per 100 g, use 100 g as the reference."}
              </p>
              <div className="form-grid four">
                {(
                  [
                    { key: "kcal", zh: "热量", en: "Energy", unit: "kcal" },
                    { key: "protein", zh: "蛋白质", en: "Protein", unit: "g" },
                    { key: "carbs", zh: "碳水", en: "Carbs", unit: "g" },
                    { key: "fat", zh: "脂肪", en: "Fat", unit: "g" },
                  ] as const
                ).map((nutrient) => (
                  <label className="field" key={nutrient.key}>
                    {zh ? nutrient.zh : nutrient.en} ({nutrient.unit})
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max={nutrient.key === "kcal" ? 100000 : 10000}
                      step="any"
                      required
                      value={draft[nutrient.key]}
                      onChange={(event) =>
                        patch({ [nutrient.key]: event.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="field">
                {zh ? "数值来源" : "Nutrition source"}
                <select
                  className="input"
                  value={draft.source}
                  onChange={(event) =>
                    patch({ source: event.target.value as "manual" | "label" })
                  }
                >
                  <option value="manual">
                    {zh ? "手动填写" : "Manual entry"}
                  </option>
                  <option value="label">
                    {zh ? "包装营养标签" : "Package nutrition label"}
                  </option>
                </select>
              </label>
              <div className="panel">
                <strong>{zh ? "这一餐实际摄入" : "Your meal intake"}</strong>
                <p className="muted">
                  {previewValues
                    ? previewValues.kcal +
                      " kcal · " +
                      (zh ? "蛋白质 " : "Protein ") +
                      previewValues.protein +
                      " g · " +
                      (zh ? "碳水 " : "Carbs ") +
                      previewValues.carbs +
                      " g · " +
                      (zh ? "脂肪 " : "Fat ") +
                      previewValues.fat +
                      " g"
                    : zh
                      ? "填写份量与营养数值后显示。"
                      : "Enter the portion and nutrition to see totals."}
                </p>
              </div>
              <label className="field">
                <span>
                  <Camera size={17} />{" "}
                  {zh ? "附加照片（可选）" : "Attach a photo (optional)"}
                </span>
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <p className="hint">
                {demo
                  ? zh
                    ? "演示照片仅在本页预览，离开后不保留；不会上传。"
                    : "Demo photos stay in this page only and are never uploaded."
                  : zh
                    ? "照片保存到当前账户的私有附件，仅支持 JPEG、PNG、WebP，最多 5 MB。"
                    : "Photos are saved as private account attachments. JPEG, PNG or WebP, up to 5 MB."}
              </p>
              {file || draft.assetId ? (
                <div className="record-row">
                  <Photo
                    file={file ?? undefined}
                    assetId={draft.assetId}
                    name={
                      draft.name ||
                      (zh ? "待保存的餐食照片" : "Meal photo to save")
                    }
                  />
                  <div className="row-main">
                    <span>
                      {file?.name || (zh ? "已保存的照片" : "Saved photo")}
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={removePhoto}
                  >
                    {zh ? "移除照片" : "Remove photo"}
                  </button>
                </div>
              ) : null}
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
          title={zh ? "删除这一餐？" : "Delete this meal?"}
          description={deleting.name}
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
                    : "Delete meal"}
              </button>
            </>
          }
        >
          <p>
            {zh
              ? "删除后，这餐不再计入摄入与趋势。"
              : "This meal will no longer count toward intake or trends."}
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
