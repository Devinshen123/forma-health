import type { AppState, User, Capabilities, FoodPhotoDraft, Language } from "./types";
export interface Snapshot {
  state: AppState;
  revision: number;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
let accountHint: string | null = null;
export function setAccountHint(id: string | null) {
  accountHint = id;
}
function errorMessage(message: string, status: number, code?: string) {
  if (localStorage.getItem("forma-language") === "en") return message;
  const aiMessages: Record<string, string> = {
    AI_NOT_CONFIGURED: "识图服务尚未配置密钥，可先手动记录。",
    AI_CONFIG_INVALID: "识图服务配置需要检查，可先手动记录。",
    AI_CONSENT_REQUIRED: "请先同意将这张照片发送给 OpenAI 进行识别。",
    AI_RATE_LIMIT: "识图请求过于频繁，请稍后重试。",
    AI_BUDGET_LIMIT: "今日识图额度已用完，可继续手动记录。",
    AI_TIMEOUT: "照片识别超时，请重试或手动记录。",
    AI_UNAVAILABLE: "暂时无法连接识图服务，请重试或手动记录。",
    AI_INVALID_OUTPUT: "识别结果未通过检查，请重试或手动记录。",
    AI_REFUSED: "这张照片无法用于食物识别，请更换照片或手动记录。",
    AI_IMAGE_INVALID: "请使用有效的 JPEG、PNG 或 WebP 图片（最大 5 MB、2000 万像素）。",
  };
  if (code && aiMessages[code]) return aiMessages[code];
  if (/already exists/.test(message)) return "这个邮箱已有账户，请改用登录。";
  if (/Email or password/.test(message)) return "邮箱或密码不正确。";
  if (/data changed/.test(message))
    return "另一窗口更新了记录。已刷新，请检查后重新保存。";
  if (/Account changed/.test(message))
    return "账户在另一窗口发生了变化，请重新登录后保存。";
  if (/password/i.test(message)) return "密码验证失败，请重试。";
  if (status === 401) return "登录已失效，请重新登录。";
  if (status === 429) return "操作过于频繁，请稍后再试。";
  if (status === 413) return "文件过大，请使用较小的文件。";
  if (/attachment|file content|supported type/i.test(message))
    return "文件格式或内容不受支持，请选择有效图片或 PDF。";
  if (status === 400) return "记录内容不符合要求，请检查日期、数值和填写项。";
  return "暂时无法完成操作，请稍后重试。";
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accountHint ? { "X-Forma-Account": accountHint } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      errorMessage(
        data.error || `Request failed (${response.status})`,
        response.status,
        data.code,
      ),
      response.status,
      data.code,
    );
  return data;
}
export const getMe = () => request<{ user: User | null }>("/auth/me");
export const login = (email: string, password: string) =>
  request<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
export const register = (email: string, password: string, name: string) =>
  request<{ user: User }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
export const logout = () =>
  request("/auth/logout", { method: "POST", body: "{}" });
export const getState = () => request<Snapshot>("/state");
export const putState = (state: AppState, revision: number) =>
  request<Snapshot>("/state", {
    method: "PUT",
    body: JSON.stringify({ state, revision }),
  });
export async function uploadFile(
  file: File,
  signal?: AbortSignal,
): Promise<{ id: string; name: string; mime: string }> {
  const expectedAccount = accountHint;
  const base64 = await new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    const reader = new FileReader();
    const cancel = () => reader.abort();
    const cleanup = () => signal?.removeEventListener("abort", cancel);
    reader.onload = () => {
      cleanup();
      resolve(String(reader.result).split(",")[1]);
    };
    reader.onerror = () => { cleanup(); reject(new Error("Unable to read image file")); };
    reader.onabort = () => { cleanup(); reject(new DOMException("Upload cancelled", "AbortError")); };
    signal?.addEventListener("abort", cancel, { once: true });
    reader.readAsDataURL(file);
  });
  return request("/assets", {
    method: "POST",
    signal,
    headers: { "X-Forma-Account": expectedAccount ?? "" },
    body: JSON.stringify({ name: file.name, mime: file.type, base64 }),
  });
}
export const assetUrl = (id: string) => `/api/assets/${encodeURIComponent(id)}`;
export const getCapabilities = () => request<Capabilities>("/capabilities");
export const analyzeFoodPhoto = (
  assetId: string,
  language: Language,
  signal?: AbortSignal,
) => request<FoodPhotoDraft>("/food-photo-drafts", {
  method: "POST",
  signal,
  body: JSON.stringify({ assetId, consent: true, language }),
});
