import type { AppState, User } from "./types";
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
function errorMessage(message: string, status: number) {
  if (localStorage.getItem("forma-language") === "en") return message;
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
): Promise<{ id: string; name: string; mime: string }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return request("/assets", {
    method: "POST",
    body: JSON.stringify({ name: file.name, mime: file.type, base64 }),
  });
}
export const assetUrl = (id: string) => `/api/assets/${encodeURIComponent(id)}`;
