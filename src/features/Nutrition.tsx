import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Check, Copy, Pencil, Plus, RefreshCw, Square, Trash2, Utensils } from "lucide-react";
import { analyzeFoodPhoto, ApiError, assetUrl, getCapabilities, request, uploadFile } from "../api";
import { Modal } from "../components/Modal";
import { RecordingDatePicker } from '../components/RecordingDatePicker';
import { RecordDiscardDialog } from '../components/RecordDiscardDialog';
import { recordingToday } from './recordingDates';
import { useRecordGuard } from './useRecordGuard';
import { mealDraftTotals, newMealDraft, recentReusableMeals, reuseMealDraft, type MealDraft } from './mealEditor';
import { AttachmentLifecycle } from "./attachmentLifecycle";
import { RecordBatchDraft, RecordDraft } from "./recordDraft";
import {
  mealTotals,
  uid,
  type FeatureProps,
  type Capabilities,
  type FoodPhotoDraft,
  type FoodPhotoItem,
  type Meal,
} from "../types";

type ReviewItem = { index: number; mealId: string; name: string; grams: string; kcal: string; protein: string; carbs: string; fat: string };
const asReviewItem = (item: FoodPhotoItem, index: number): ReviewItem => ({
  index, mealId: uid(), name: item.name, grams: item.grams === null ? "" : String(item.grams),
  kcal: item.per100g.kcal === null ? "" : String(item.per100g.kcal),
  protein: item.per100g.protein === null ? "" : String(item.per100g.protein),
  carbs: item.per100g.carbs === null ? "" : String(item.per100g.carbs),
  fat: item.per100g.fat === null ? "" : String(item.per100g.fat),
});
const completeReviewItem = (item: ReviewItem) => {
  const values = [item.grams, item.kcal, item.protein, item.carbs, item.fat];
  if (!item.name.trim() || item.name.trim().length > 160 || values.some(value => !value.trim() || !Number.isFinite(Number(value)))) return false;
  const [grams, kcal, protein, carbs, fat] = values.map(Number);
  return grams > 0 && grams <= 10000 && kcal >= 0 && kcal <= 1200 &&
    [protein, carbs, fat].every(value => value >= 0 && value <= 100) && protein + carbs + fat <= 111;
};
const reviewTotals = (item: ReviewItem) => completeReviewItem(item) ? mealTotals({
  id: "", date: "", type: "lunch", name: item.name, grams: Number(item.grams), referenceGrams: 100,
  kcal: Number(item.kcal), protein: Number(item.protein), carbs: Number(item.carbs), fat: Number(item.fat),
  source: "ai_estimate", createdAt: "",
}) : null;
const photoError = (cause: unknown, zh: boolean) => {
  const code = cause instanceof ApiError ? cause.code : undefined;
  const messages: Record<string, [string, string]> = {
    AI_NOT_CONFIGURED: ["照片识别尚未配置。你可以继续手动填写，不会发送图片给 OpenAI。", "Photo analysis is not configured. Continue manually; the image will not be sent to OpenAI."],
    AI_CONFIG_INVALID: ["识图服务配置无效，请稍后重试或改用手动填写。", "Photo analysis has an invalid configuration. Try later or continue manually."],
    AI_CONSENT_REQUIRED: ["请先同意将这张照片发送给 OpenAI，再开始识别。", "Consent to send this photo to OpenAI before analyzing it."],
    AI_RATE_LIMIT: ["识别过于频繁，或已达到次数上限。请稍后重试或手动填写。", "Analysis is too frequent or its attempt limit has been reached. Try later or enter the meal manually."],
    AI_BUDGET_LIMIT: ["识图预算限额已用完。你仍可手动记录。", "The photo-analysis budget limit has been reached. Manual logging is still available."],
    AI_TIMEOUT: ["识别超时，没有保存饮食记录。请重新同意后重试，或手动填写。", "Analysis timed out. No meal was saved. Consent again to retry, or continue manually."],
    AI_UNAVAILABLE: ["识图服务暂时不可用，没有保存饮食记录。请稍后重试或手动填写。", "Photo analysis is temporarily unavailable. No meal was saved. Try later or continue manually."],
    AI_INVALID_OUTPUT: ["识别结果未通过校验，没有保存饮食记录。请换一张照片或手动填写。", "The analysis did not pass validation. No meal was saved. Choose another photo or enter the meal manually."],
    AI_REFUSED: ["这张照片未能生成食物草稿。请换一张照片或手动填写。", "This photo could not produce a food draft. Choose another photo or continue manually."],
    AI_IMAGE_INVALID: ["照片无法读取，请选择有效的 JPEG、PNG 或 WebP 图片。", "The photo could not be read. Choose a valid JPEG, PNG or WebP image."],
  };
  if (code && messages[code]) return messages[code][zh ? 0 : 1];
  if (cause instanceof ApiError && cause.status === 401) return zh ? "登录已失效，请重新登录；未保存这餐。" : "Your session has expired. Sign in again; this meal was not saved.";
  if (cause instanceof ApiError && cause.status === 409) return zh ? "账户或记录已变化，请刷新后核对再保存。" : "The account or records changed. Refresh and review before saving.";
  if (cause instanceof ApiError && cause.status === 404) return zh ? "这张私有照片暂不可用，请重新选择上传。" : "This private photo is unavailable. Choose and upload it again.";
  return zh ? "暂时无法完成操作，请重试或继续手动填写。" : "Could not complete this action. Retry or continue manually.";
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
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
  accountId,
  onCreate,
  onUnsavedChange,
}: FeatureProps & { onCreate?: () => void }) {
  const zh = lang === "zh";
  const [date, setDate] = useState(() => recordingToday(state.profile?.timezone));
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const initialDraft = useRef('');
  const initialFile = useRef<File | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [choosingReuse, setChoosingReuse] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [demoPhotos, setDemoPhotos] = useState<Record<string, File>>({});
  const [deleting, setDeleting] = useState<Meal | null>(null);
  const editRecord = useRef<RecordDraft<Meal> | null>(null);
  const deleteRecord = useRef<RecordDraft<Meal> | null>(null);
  useEffect(() => { if (draft) editRecord.current?.observe(state.meals.find(meal => meal.id === draft.id)); }, [state.meals, draft?.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"manual" | "photo">("manual");
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState(false);
  const [capabilityLoading, setCapabilityLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<"uploading" | "analyzing">("analyzing");
  const [aiDraft, setAiDraft] = useState<FoodPhotoDraft | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const aiRecords = useRef(new RecordBatchDraft<Meal>());
  const aiSubmitted = aiRecords.current.hasSubmitted;
  useEffect(() => { aiRecords.current.observe(state.meals); }, [state.meals]);
  const mounted = useRef(true);
  const analysisSequence = useRef(0);
  const analysisController = useRef<AbortController | null>(null);
  const ownerAccount = useRef(accountId ?? "").current;
  const deleteUpload = (id: string) => request("/assets/" + encodeURIComponent(id), {
    method: "DELETE", body: "{}", headers: { "X-Forma-Account": ownerAccount },
  });
  const uploads = useRef(new AttachmentLifecycle(deleteUpload));
  const capabilitySequence = useRef(0);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const focusedDraftId = useRef<string | null>(null);
  const working = busy || analyzing;
  const dirty = !!draft && (attempted || JSON.stringify(draft) !== initialDraft.current || file !== initialFile.current || !!aiDraft || aiSubmitted);
  useRecordGuard(dirty, working, onUnsavedChange);
  const reusableMeals = recentReusableMeals(state.meals);
  const previewValues = draft ? mealDraftTotals(draft) : null;
  const rememberUpload = (id: string | null) => { uploads.current.stage(id); setUploadedId(id); };
  const refreshCapabilities = async () => {
    const sequence = ++capabilitySequence.current;
    setCapabilityLoading(true); setCapabilityError(false);
    try {
      const result = await getCapabilities();
      if (mounted.current && sequence === capabilitySequence.current) setCapabilities(result);
    } catch {
      if (mounted.current && sequence === capabilitySequence.current) { setCapabilities(null); setCapabilityError(true); }
    } finally {
      if (mounted.current && sequence === capabilitySequence.current) setCapabilityLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void refreshCapabilities();
    return () => {
      mounted.current = false;
      analysisSequence.current++;
      capabilitySequence.current++;
      analysisController.current?.abort();
      if (!demo) void uploads.current.discard().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!aiDraft || analyzing || focusedDraftId.current === aiDraft.id) return;
    const heading = reviewHeading.current;
    if (!heading) return;
    focusedDraftId.current = aiDraft.id;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start", behavior: "auto" });
  }, [aiDraft?.id, analyzing]);
  const invalidateAnalysis = () => {
    analysisSequence.current++;
    analysisController.current?.abort();
    analysisController.current = null;
    setAnalyzing(false); setAiDraft(null); setReviewItems([]); setReviewed(false); setConsent(false);
    aiRecords.current = new RecordBatchDraft<Meal>();
  };
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
    const pendingAsset = uploads.current.id;
    if (!pendingAsset || demo) return true;
    try {
      await uploads.current.discard();
      if (!mounted.current) return false;
      if (!uploads.current.id) setUploadedId(null);
      return true;
    } catch {
      if (!mounted.current) return false;
      setError(
        zh ? "未保存的照片清理失败，请重试关闭。" : "Could not remove the unsaved photo. Try closing again.",
      );
      notify(
        "未保存的照片暂未清理，请重试",
        "The unsaved photo could not be removed. Please retry.",
      );
      return false;
    }
  };
  const close = async () => {
    if (!mounted.current || busy) return;
    invalidateAnalysis();
    setBusy(true);
    try {
      if (await discardUpload()) {
        setDraft(null);
        setFile(null);
        rememberUpload(null);
        setError("");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const requestClose = () => {
    if (!mounted.current || busy) return;
    if (dirty) setDiscarding(true);
    else void close();
  };
  const open = (meal?: Meal, reuse?: Meal) => {
    if (!mounted.current || working) return;
    editRecord.current = new RecordDraft(meal);
    invalidateAnalysis();
    setError("");
    setMode("manual");
    rememberUpload(null);
    const nextFile = meal ? (demoPhotos[meal.id] ?? null) : null;
    initialFile.current = nextFile;
    setFile(nextFile);
    const next: MealDraft =
      meal
        ? {
            ...meal,
            existing: true,
            grams: String(meal.grams),
            referenceGrams: String(meal.referenceGrams),
            kcal: String(meal.kcal),
            protein: String(meal.protein),
            carbs: String(meal.carbs),
            fat: String(meal.fat),
            source: meal.source,
          }
        : reuse ? reuseMealDraft(reuse, date) : newMealDraft(date);
    initialDraft.current = JSON.stringify(reuse ? { ...next, name: '' } : next);
    setAttempted(false);
    setDiscarding(false);
    setChoosingReuse(false);
    setDraft(next);
  };
  const patch = (change: Partial<MealDraft>) =>
    setDraft((current) => (current ? { ...current, ...change } : null));
  const chooseFile = async (selected?: File) => {
    if (!mounted.current || working || aiSubmitted) return;
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
    invalidateAnalysis();
    setBusy(true);
    try {
      if (await discardUpload()) {
        setFile(selected);
        rememberUpload(null);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const removePhoto = async () => {
    if (!mounted.current || busy) return;
    invalidateAnalysis();
    setBusy(true);
    try {
      if (await discardUpload()) {
        setFile(null);
        rememberUpload(null);
        patch({ assetId: undefined });
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mounted.current || !draft || working) return;
    if (!editRecord.current?.canSave(state.meals.find(meal => meal.id === draft.id))) {
      setError(zh ? "这条记录已在另一处变化或删除，请取消并重新打开核对。" : "This record changed or was deleted elsewhere. Cancel and reopen to review it.");
      return;
    }
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
        const result = await uploadFile(file, undefined, ownerAccount);
        if (!mounted.current) {
          void deleteUpload(result.id).catch(() => {});
          return;
        }
        attachment = result.id;
        rememberUpload(result.id);
      }
      const meal: Meal = {
        id: draft.id,
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
        ...(draft.source === "ai_estimate" ? { aiDraftId: draft.aiDraftId, aiItemIndex: draft.aiItemIndex } : {}),
        createdAt: draft.createdAt,
      };
      // Keep this attachment even if save rejects: it may already be in the
      // account's outbox, or the server may have accepted a timed-out request.
      uploads.current.retainForSave(attachment);
      setAttempted(true);
      editRecord.current.submittedValue(meal);
      await save({
        ...state,
        meals: state.meals.some(item => item.id === meal.id)
          ? state.meals.map((item) => (item.id === meal.id ? meal : item))
          : [...state.meals, meal],
      });
      if (!mounted.current) return;
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
      rememberUpload(null);
      notify("这餐已保存", "Meal saved");
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        photoError(cause, zh),
      );
      notify("尚未确认保存，请查看同步状态后重试", "Save not confirmed. Check sync status before retrying.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const remove = async () => {
    if (!mounted.current || !deleting || busy) return;
    if (!deleteRecord.current?.canSave(state.meals.find(meal => meal.id === deleting.id))) {
      setError(zh ? "这条记录已在另一处变化，请取消并重新核对后再删除。" : "This record changed elsewhere. Cancel and review it before deleting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      deleteRecord.current.submittedValue(undefined);
      await save({
        ...state,
        meals: state.meals.filter((meal) => meal.id !== deleting.id),
      });
      if (!mounted.current) return;
      setDemoPhotos((current) => {
        const next = { ...current };
        delete next[deleting.id];
        return next;
      });
      setDeleting(null);
      notify("饮食记录已删除", "Meal deleted");
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        photoError(cause, zh),
      );
      notify("删除暂未确认，请查看同步状态后重试", "Deletion is not confirmed. Check sync status before retrying.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const changeMode = (next: "manual" | "photo") => {
    if (!mounted.current || working || draft?.existing || aiSubmitted) return;
    invalidateAnalysis(); setMode(next); setError("");
  };
  const cancelAnalysis = () => {
    invalidateAnalysis();
    setError(zh ? "已取消等待，未保存饮食记录。你可以重试或手动填写。" : "Stopped waiting. No meal was saved. You can retry or enter it manually.");
  };
  const runAnalysis = async () => {
    if (!mounted.current || !draft || working || aiSubmitted) return;
    if (demo) { onCreate?.(); return; }
    if (!file) { setError(zh ? "请先选择食物照片。" : "Choose a food photo first."); return; }
    if (!capabilities?.foodPhoto.available) { setError(zh ? "识图服务尚未就绪。请刷新状态或改用手动填写。" : "Photo analysis is not ready. Refresh its status or continue manually."); return; }
    if (!consent) { setError(zh ? "请先同意将这张照片发送给 OpenAI。" : "Consent to send this photo to OpenAI first."); return; }
    const selectedFile = file;
    const sequence = ++analysisSequence.current;
    const controller = new AbortController();
    analysisController.current = controller;
    setAnalyzing(true); setError(""); setAiDraft(null); setReviewItems([]); setReviewed(false);
    try {
      let attachment = uploads.current.id;
      if (!attachment) {
        setAnalysisStage("uploading");
        const uploaded = await uploadFile(selectedFile, controller.signal, ownerAccount);
        if (!mounted.current || sequence !== analysisSequence.current || controller.signal.aborted) {
          void deleteUpload(uploaded.id).catch(() => {});
          return;
        }
        attachment = uploaded.id;
        rememberUpload(attachment);
      }
      setAnalysisStage("analyzing");
      const result = await analyzeFoodPhoto(attachment, lang, controller.signal, ownerAccount);
      if (!mounted.current || sequence !== analysisSequence.current || controller.signal.aborted) return;
      if (result.assetId !== attachment) throw new Error("Mismatched photo draft");
      setAiDraft(result);
      setReviewItems(result.items.map(asReviewItem));
      if (!result.isFood || !result.items.length) setError(zh ? "没有识别出可审核的食物。换一张照片，或改用手动填写。" : "No food candidates to review. Choose another photo or enter the meal manually.");
    } catch (cause) {
      if (!mounted.current || sequence !== analysisSequence.current || controller.signal.aborted) return;
      setError(photoError(cause, zh));
      if (cause instanceof ApiError && ["AI_NOT_CONFIGURED", "AI_CONFIG_INVALID"].includes(cause.code ?? "")) void refreshCapabilities();
    } finally {
      if (mounted.current && sequence === analysisSequence.current) {
        setAnalyzing(false);
        setConsent(false);
        analysisController.current = null;
      }
    }
  };
  const patchReviewItem = (index: number, change: Partial<ReviewItem>) => {
    setReviewItems(current => current.map(item => item.index === index ? { ...item, ...change } : item));
    setReviewed(false);
  };
  const confirmAi = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mounted.current || !draft || working || demo) return;
    if (!aiDraft?.isFood || aiDraft.assetId !== uploads.current.id || !reviewItems.length ||
      !reviewed || reviewItems.some(item => !completeReviewItem(item))) {
      setError(zh ? "请保留至少一项食物，补全所有空值，并确认已核对后再保存。" : "Keep at least one food, fill every unknown value, and confirm your review before saving.");
      return;
    }
    setBusy(true); setError("");
    try {
      const reviewedMeals: Meal[] = reviewItems.map(item => ({
        id: item.mealId, name: item.name.trim(), date: draft.date, type: draft.type, grams: Number(item.grams),
        referenceGrams: 100, kcal: Number(item.kcal), protein: Number(item.protein), carbs: Number(item.carbs), fat: Number(item.fat),
        source: "ai_estimate", assetId: aiDraft.assetId, aiDraftId: aiDraft.id, aiItemIndex: item.index, createdAt: draft.createdAt,
      }));
      if (!aiRecords.current.canSave(reviewedMeals, state.meals)) {
        setError(zh ? "这批记录已在另一处变化或删除，请取消并在记录中重新核对。" : "These records changed or were deleted elsewhere. Cancel and review the saved records.");
        return;
      }
      const reviewedIds = new Set(reviewedMeals.map(meal => meal.id));
      uploads.current.retainForSave(aiDraft.assetId);
        setAttempted(true);
      aiRecords.current.submittedValues(reviewedMeals);
      await save({ ...state, meals: [...state.meals.filter(meal => !reviewedIds.has(meal.id)), ...reviewedMeals] });
      if (!mounted.current) return;
      rememberUpload(null);
      setDate(draft.date); setDraft(null); setFile(null); invalidateAnalysis();
      notify("已保存 " + reviewedMeals.length + " 项审核后的 AI 估算", reviewedMeals.length + (reviewedMeals.length === 1 ? " reviewed AI estimate saved" : " reviewed AI estimates saved"));
    } catch (cause) {
      if (!mounted.current) return;
      setError(photoError(cause, zh));
      notify("尚未确认保存，请查看同步状态后重试", "Save not confirmed. Check sync status before retrying.");
    } finally { if (mounted.current) setBusy(false); }
  };
  const aiTotals = reviewItems.length && reviewItems.every(completeReviewItem) ? reviewItems.reduce((sum, item) => {
    const value = reviewTotals(item)!;
    return { kcal: sum.kcal + value.kcal, protein: sum.protein + value.protein, carbs: sum.carbs + value.carbs, fat: sum.fat + value.fat };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 }) : null;
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
        <div className="row-actions"><button className="btn btn-secondary" disabled={!reusableMeals.length || working} onClick={() => setChoosingReuse(true)}>
          <Copy size={17} />{zh ? '复用最近饮食' : 'Reuse a recent meal'}
        </button><button className="btn btn-primary" onClick={() => open()}>
          <Plus size={18} />
          {zh ? "记录一餐" : "Log a meal"}
        </button></div>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>{zh ? "每日摄入" : "Daily intake"}</h2>
          <RecordingDatePicker value={date} onChange={setDate} label={zh ? '日期' : 'Date'} lang={lang} timezone={state.profile?.timezone} />
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
                      deleteRecord.current = new RecordDraft(meal);
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
          ? "照片识别生成可编辑的 AI 草稿，审核后才会保存；也可以继续手动填写。"
          : "Photo analysis creates an editable AI draft. Nothing is saved until you review it. Manual entry remains available."}
      </p>
      {draft ? (
        <Modal
          title={
            draft.existing
              ? zh
                ? "编辑这一餐"
                : "Edit this meal"
              : zh
                ? "记录这一餐"
                : "Log this meal"
          }
          description={
            mode === "photo" ? zh
              ? "选择照片 → 核对每项食物与份量 → 确认保存。"
              : "Choose a photo → review each food and portion → confirm and save."
            : zh
              ? "营养按标定重量填写，摄入按实际重量计算。"
              : "Enter nutrition for the reference weight. Intake scales to the weight you ate."
          }
          onClose={requestClose}
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={requestClose}
              >
                {analyzing ? zh ? "停止等待并关闭" : "Stop waiting and close" : zh ? "取消" : "Cancel"}
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                form={mode === "photo" ? "nutrition-photo-form" : "nutrition-form"}
                disabled={working || (mode === "photo" && (!aiDraft?.isFood || !reviewItems.length || !reviewed || !reviewItems.every(completeReviewItem)))}
              >
                {busy
                  ? zh
                    ? "保存中…"
                    : "Saving…"
                  : mode === "photo" ? zh ? "确认并保存 " + reviewItems.length + " 项" : "Confirm and save " + reviewItems.length + (reviewItems.length === 1 ? " item" : " items")
                  : zh
                    ? "确认并保存"
                    : "Confirm and save"}
              </button>
            </>
          }
        >
          {!draft.existing ? <div className="segmented" aria-label={zh ? "记录方式" : "Entry method"}>
            <button className={mode === "manual" ? "selected" : ""} type="button" aria-pressed={mode === "manual"} disabled={working || aiSubmitted} onClick={() => changeMode("manual")}>{zh ? "手动填写" : "Manual entry"}</button>
            <button className={mode === "photo" ? "selected" : ""} type="button" aria-pressed={mode === "photo"} disabled={working || aiSubmitted} onClick={() => changeMode("photo")}><Camera size={17} />{zh ? "照片识别" : "Photo analysis"}</button>
          </div> : null}
          {mode === "photo" ? <form id="nutrition-photo-form" className="stack" onSubmit={confirmAi}>
            <fieldset disabled={working} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="form-grid">
                <label className="field">{zh ? "日期" : "Date"}<input className="input" type="date" required value={draft.date} onInput={event => patch({ date: event.currentTarget.value })} onChange={event => patch({ date: event.target.value })} /></label>
                <label className="field">{zh ? "餐次" : "Meal"}<select className="input" value={draft.type} onChange={event => patch({ type: event.target.value as Meal["type"] })}>{(["breakfast", "lunch", "dinner", "snack"] as const).map(type => <option key={type} value={type}>{typeLabel(type)}</option>)}</select></label>
              </div>
              <label className="field">{zh ? "食物照片" : "Food photo"}<input className="input" type="file" accept="image/jpeg,image/png,image/webp" disabled={aiSubmitted} onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} /></label>
              <p className="hint">{demo ? zh ? "JPEG、PNG 或 WebP，最多 5 MB。演示照片仅在本页预览，不会上传。" : "JPEG, PNG or WebP, up to 5 MB. Demo photos stay in this page and are never uploaded." : zh ? "JPEG、PNG 或 WebP，最多 5 MB。原图作为当前账户的私有附件保存。" : "JPEG, PNG or WebP, up to 5 MB. The original is saved as a private attachment in your account."}</p>
              {file ? <div className="ai-photo-summary">
                <Photo file={file} name={file.name} />
                <div><strong>{file.name}</strong><p className="muted">{zh ? "1 · 选择照片　2 · 审核草稿　3 · 确认保存" : "1 · Choose photo　2 · Review draft　3 · Confirm save"}</p></div>
              </div> : null}
              {demo ? <div className="panel"><strong>{zh ? "演示模式不会调用 AI" : "Demo mode does not call AI"}</strong><p className="muted">{zh ? "创建真实账户后，才可私有上传并使用识图。这里不会生成假识别结果。" : "Create a real account to upload privately and use photo analysis. Demo mode does not generate simulated results."}</p><button className="btn btn-secondary" type="button" onClick={onCreate}>{zh ? "创建账户后使用识图" : "Create an account for photo analysis"}</button></div>
                : <div className="panel stack">
                  <div className="section-title"><strong>{zh ? "识图服务状态" : "Photo analysis status"}</strong><button className="btn btn-ghost" type="button" disabled={capabilityLoading || working} onClick={() => void refreshCapabilities()}><RefreshCw size={15} />{zh ? "刷新状态" : "Refresh status"}</button></div>
                  <p className="muted" role="status">{capabilityLoading ? zh ? "正在读取配置…" : "Checking configuration…" : capabilityError ? zh ? "暂时无法读取状态，可继续手动填写。" : "Could not read the status. Manual entry is still available." : capabilities?.foodPhoto.available ? zh ? "识图已配置；真实照片质量仍需验证。" : "Photo analysis is configured; real-photo quality still needs validation." : capabilities?.foodPhoto.reason === "invalid_config" ? zh ? "识图配置无效，请联系本机管理员；可继续手动填写。" : "Photo analysis configuration is invalid. Contact the local administrator; manual entry remains available." : zh ? "待配置 OpenAI 密钥。你仍可手动保存照片与营养。" : "Waiting for an OpenAI key. You can still save a photo and enter nutrition manually."}</p>
                  <label className="checkbox-label"><input type="checkbox" checked={consent} disabled={!file || !capabilities?.foodPhoto.available || aiSubmitted} onChange={event => setConsent(event.target.checked)} /><span>{zh ? "我同意本次将这张照片及输出语言发送给 OpenAI，用于生成可审核的食物草稿。不会随请求发送我的账户、过敏、训练、睡眠及其它记录。" : "I consent to send this photo and output language to OpenAI for this analysis, to generate a food draft I can review. My account, allergies, training, sleep and other records are not sent with it."}</span></label>
                  <p className="hint">{zh ? "发送前会压缩照片并去除 EXIF；供应商的数据保留按其政策执行。" : "The photo is resized and EXIF is removed before sending. Provider data retention follows its policies."} <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer">{zh ? "查看 OpenAI 数据政策" : "View OpenAI data policy"}</a></p>
                  <button className="btn btn-primary" type="button" disabled={!file || !consent || !capabilities?.foodPhoto.available || working || aiSubmitted} onClick={() => void runAnalysis()}><Camera size={17} />{aiDraft ? zh ? "重新识别这张照片" : "Analyze this photo again" : zh ? "识别照片" : "Analyze photo"}</button>
                </div>}
            </fieldset>
            {analyzing ? <div className="ai-photo-summary" role="status" aria-live="polite"><RefreshCw size={20} /><div><strong>{analysisStage === "uploading" ? zh ? "正在私有上传照片…" : "Uploading the photo privately…" : zh ? "正在生成食物草稿…" : "Preparing a food draft…"}</strong><p className="muted">{zh ? "尚未保存饮食记录。识别完成后请逐项核对。" : "No meal has been saved. Review each candidate when analysis finishes."}</p></div><button className="btn btn-secondary" type="button" onClick={cancelAnalysis}><Square size={15} />{zh ? "停止等待" : "Stop waiting"}</button></div> : null}
            {aiDraft && !analyzing ? <fieldset disabled={busy} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="section-title"><h3 ref={reviewHeading} tabIndex={-1}>{zh ? "审核 AI 食物草稿" : "Review the AI food draft"}</h3><span className="badge">{aiSubmitted ? zh ? "AI 估算 · 已尝试保存" : "AI estimate · Save attempted" : zh ? "AI 估算 · 未保存" : "AI estimate · Not saved"}</span></div>
              {aiSubmitted ? <p className="hint" role="status">{zh ? "这些食物可能已保存或正在等待同步。你可以校正数值并重试这一批；如需移除食物、更换照片或重新识别，请关闭后先核对已有记录。" : "These foods may already be saved or waiting to sync. You can correct values and retry this batch. Close and check existing records before removing foods, changing the photo or analyzing again."}</p> : null}
              <p className="hint">{zh ? "仅凭照片无法确定所有过敏原、隐藏食材、烹调油和准确重量。请核对名称、份量与营养；不确定的数值留空，不能直接保存。" : "A photo cannot determine every allergen, hidden ingredient, cooking oil or exact weight. Check names, portions and nutrition. Unknown values stay blank and must be completed before saving."}</p>
              {aiDraft.warnings.length ? <ul className="ai-warning-list">{aiDraft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}
              {!aiDraft.isFood || !reviewItems.length ? <p className="hint">{aiDraft.isFood ? zh ? "没有保留食物候选。你可以重新识别或改用手动填写。" : "No food candidates remain. Analyze again or continue manually." : zh ? "这张照片没有识别为食物，未添加任何记录。" : "This photo was not identified as food. No records were added."}</p> : null}
              {reviewItems.map((item, position) => {
                const itemValue = reviewTotals(item);
                const missing = ([{ key: "grams", zh: "重量", en: "weight" }, { key: "kcal", zh: "热量", en: "energy" }, { key: "protein", zh: "蛋白质", en: "protein" }, { key: "carbs", zh: "碳水", en: "carbs" }, { key: "fat", zh: "脂肪", en: "fat" }] as const).filter(field => !item[field.key].trim()).map(field => zh ? field.zh : field.en);
                return <div className="ai-item-card stack" key={item.index}>
                  <div className="section-title"><strong>{zh ? "食物 " : "Food "}{position + 1}</strong><button className="icon-button" type="button" disabled={aiSubmitted} aria-label={(zh ? "移除候选 " : "Remove candidate ") + (item.name || position + 1)} onClick={() => { if (!aiSubmitted) { setReviewItems(current => current.filter(candidate => candidate.index !== item.index)); setReviewed(false); } }}><Trash2 size={16} /></button></div>
                  <div className="form-grid"><label className="field">{zh ? "食物名称" : "Food name"}<input className="input" required maxLength={160} value={item.name} onChange={event => patchReviewItem(item.index, { name: event.target.value })} /></label><label className="field">{zh ? "实际份量（克）" : "Portion eaten (g)"}<input className="input" type="number" required min="0.01" max="10000" step="any" placeholder={zh ? "待填写" : "Unknown"} value={item.grams} onChange={event => patchReviewItem(item.index, { grams: event.target.value })} /></label></div>
                  <p className="hint">{zh ? "下方营养数值均为每 100 g；实际摄入按上方重量计算。" : "Nutrition below is per 100 g. Intake scales to the portion weight above."}</p>
                  <div className="form-grid four">{([{ key: "kcal", zh: "热量", en: "Energy", unit: "kcal" }, { key: "protein", zh: "蛋白质", en: "Protein", unit: "g" }, { key: "carbs", zh: "碳水", en: "Carbs", unit: "g" }, { key: "fat", zh: "脂肪", en: "Fat", unit: "g" }] as const).map(field => <label className="field" key={field.key}>{zh ? field.zh : field.en} ({field.unit}/100 g)<input className="input" type="number" required min="0" max={field.key === "kcal" ? 1200 : 100} step="any" placeholder={zh ? "待填写" : "Unknown"} value={item[field.key]} onChange={event => patchReviewItem(item.index, { [field.key]: event.target.value })} /></label>)}</div>
                  {missing.length ? <p className="hint">{zh ? "尚未确定： " : "Still unknown: "}{missing.join(zh ? "、" : ", ")}</p> : null}
                  <p className="muted">{zh ? "这一项实际摄入： " : "Intake for this food: "}{itemValue ? itemValue.kcal + " kcal · " + (zh ? "蛋白质 " : "Protein ") + itemValue.protein + " g · " + (zh ? "碳水 " : "Carbs ") + itemValue.carbs + " g · " + (zh ? "脂肪 " : "Fat ") + itemValue.fat + " g" : "—"}</p>
                </div>;
              })}
              {reviewItems.length ? <div className="panel"><strong>{zh ? "保留项目的合计摄入" : "Total intake for retained foods"}</strong><p className="muted">{aiTotals ? aiTotals.kcal + " kcal · " + (zh ? "蛋白质 " : "Protein ") + Math.round(aiTotals.protein * 10) / 10 + " g · " + (zh ? "碳水 " : "Carbs ") + Math.round(aiTotals.carbs * 10) / 10 + " g · " + (zh ? "脂肪 " : "Fat ") + Math.round(aiTotals.fat * 10) / 10 + " g" : zh ? "— · 补全并核对所有项目后显示合计。" : "— · Complete and check every item to see totals."}</p></div> : null}
              {reviewItems.length ? <label className="checkbox-label"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>{zh ? "我已核对保留项目的名称、份量与营养，确认将它们作为 AI 估算保存。" : "I reviewed the retained names, portions and nutrition, and confirm saving them as AI estimates."}</span></label> : null}
            </fieldset> : null}
            <button className="btn btn-ghost" type="button" disabled={working || aiSubmitted} onClick={() => changeMode("manual")}>{zh ? "改用手动填写" : "Continue with manual entry"}</button>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </form> : <form id="nutrition-form" className="stack" onSubmit={submit}>
            <fieldset
              disabled={working}
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
                    disabled={draft.source === "ai_estimate"}
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
                  {draft.source === "ai_estimate" ? <option value="ai_estimate">{zh ? "AI 估算 · 用户已审核" : "AI estimate · User reviewed"}</option> : null}
                  <option value="manual">
                    {zh ? "手动填写" : "Manual entry"}
                  </option>
                  <option value="label">
                    {zh ? "包装营养标签" : "Package nutrition label"}
                  </option>
                </select>
              </label>
              {draft.source === "ai_estimate" ? <p className="hint">{zh ? "编辑数值后仍保留 AI 估算来源、每 100 g 基准和原识别照片。若主动改为手动或标签来源，将不再保留 AI 草稿关联。" : "Editing values keeps the AI-estimate source, per-100-g reference and original analysis photo. Choosing manual or label removes the AI draft link."}</p> : null}
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
                  disabled={draft.source === "ai_estimate"}
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
                    disabled={draft.source === "ai_estimate"}
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
          </form>}
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
      {choosingReuse ? <Modal title={zh ? '复用最近饮食' : 'Reuse a recent meal'} description={zh ? '添加到 ' + date : 'Add to ' + date} onClose={() => setChoosingReuse(false)}>
        <p className="hint">{zh ? '仅复用手动或标签记录的营养数值。不会复制照片；请核对本次份量，确认后才保存。' : 'Reuse nutrition from a manual or label record. Photos are not copied. Check this portion before saving.'}</p>
        {reusableMeals.map(meal => <div className="record-row" key={meal.id}>
          <div className="row-main"><strong>{meal.name}</strong><p className="muted">{meal.date} · {typeLabel(meal.type)} · {meal.grams} g · {sourceLabel(meal.source)}</p></div>
          <button className="btn btn-secondary" onClick={() => open(undefined, meal)} aria-label={(zh ? '复用 ' : 'Reuse ') + meal.name}>{zh ? '选择' : 'Choose'}</button>
        </div>)}
      </Modal> : null}
      {discarding ? <RecordDiscardDialog lang={lang} onKeep={() => setDiscarding(false)} onDiscard={() => { setDiscarding(false); void close(); }} /> : null}
    </div>
  );
}
