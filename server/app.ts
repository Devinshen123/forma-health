import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { z, ZodError } from "zod";
import { Store, type Account } from "./store";
import {
  credentialsSchema,
  idSchema,
  passwordSchema,
  putStateSchema,
  registerSchema,
  validateTransition,
  parseState,
} from "./validation";
import type { AppState, User, SyncMutation } from "../src/types";
import { syncMutationSchema, SyncConflict } from './sync';
import { FoodPhotoService, type FoodPhotoAiConfig } from './food-photo';
import { AiError } from './ai-errors';
import { trainingWorkbenchRouter } from './training-workbench';
import { WorkbenchConflict, WorkbenchError } from './training-workbench-data';
import { companionRouter } from './companion-router';
import { CompanionError } from './companion';

const COOKIE = "forma_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const localOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);
const publicUser = ({ id, email, name }: User): User => ({ id, email, name });
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolveHash, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, result) => (error ? reject(error) : resolveHash(result)),
    );
  });
async function verifyPassword(password: string, account?: Account) {
  const hash = await derive(
    password,
    account?.password_salt ?? randomBytes(16).toString("hex"),
  );
  return (
    !!account &&
    timingSafeEqual(hash, Buffer.from(account.password_hash, "hex"))
  );
}
const uploadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine(
        (value) => !/[\x00-\x1f\x7f]/.test(value),
        "File name contains control characters",
      ),
    mime: z.enum([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "application/pdf",
    ]),
    // A single character-class scan avoids RegExp stack growth on a 10 MB upload.
    // Canonical padding and decoded size are checked again after decoding.
    base64: z
      .string()
      .min(4)
      .max(Math.ceil(MAX_ASSET_BYTES / 3) * 4)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .refine((value) => value.length % 4 === 0, "Invalid base64 length"),
  })
  .strict();
function matchesMagic(bytes: Buffer, mime: string) {
  if (mime === "image/png")
    return (
      bytes.length >= 24 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.toString("ascii", 12, 16) === "IHDR"
    );
  if (mime === "image/jpeg")
    return (
      bytes.length >= 4 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  if (mime === "image/gif")
    return (
      bytes.length >= 13 &&
      ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))
    );
  if (mime === "image/webp")
    return (
      bytes.length >= 16 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  return (
    bytes.length >= 12 &&
    /^%PDF-1\.[0-9]|^%PDF-2\.0/.test(bytes.toString("ascii", 0, 8)) &&
    bytes
      .subarray(Math.max(0, bytes.length - 1024))
      .includes(Buffer.from("%%EOF"))
  );
}
const referencedAssets = (state: AppState) =>
  new Set(
    [...state.meals, ...state.reports].flatMap((item) =>
      item.assetId ? [item.assetId] : [],
    ),
  );
class StateInputError extends Error {}

export interface AppOptions {
  dataDir: string;
  distDir?: string;
  secureCookies?: boolean;
  ai?: FoodPhotoAiConfig;
  aiFetch?: typeof fetch;
  aiNow?: () => number;
  companionNow?: () => number;
  trustProxy?: number;
}
export function createApp(options: AppOptions) {
  const store = new Store(options.dataDir, options.companionNow),
    app = express();
  const foodPhoto = new FoodPhotoService(store, options.ai, options.aiFetch, options.aiNow);
  const secureCookies =
    options.secureCookies ?? process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: secureCookies,
    path: "/",
  };
  app.disable("x-powered-by");
  app.set('trust proxy', options.trustProxy ?? false);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = req.get("origin");
    const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);
    // No permissive CORS: only the local frontend and explicitly same-origin HTTPS may write.
    const sameHttpsOrigin =
      secureCookies && req.secure && origin === `https://${req.get("host")}`;
    if (origin && !localOrigins.has(origin) && !sameHttpsOrigin)
      return res.status(403).json({ error: "Request origin is not allowed" });
    if (
      !safeMethod &&
      (!origin || (!localOrigins.has(origin) && !sameHttpsOrigin))
    )
      return res
        .status(403)
        .json({ error: "A trusted request origin is required" });
    if (req.get("sec-fetch-site") === "cross-site")
      return res
        .status(403)
        .json({ error: "Cross-site requests are not allowed" });
    if (!safeMethod && !req.is("application/json"))
      return res.status(415).json({ error: "Use application/json" });
    next();
  });
  app.use("/api/assets", express.json({ limit: "14mb", strict: true }));
  app.use("/api", express.json({ limit: "2mb", strict: true }), cookieParser());

  const buckets = new Map<string, { count: number; until: number }>();
  const rateLimit = (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now(),
      address = req.ip ?? "local";
    if (buckets.size > 2000)
      for (const [key, bucket] of buckets)
        if (bucket.until <= now) buckets.delete(key);
    let bucket = buckets.get(address);
    if (!bucket || bucket.until <= now) {
      bucket = { count: 0, until: now + 15 * 60 * 1000 };
      buckets.set(address, bucket);
    }
    if (++bucket.count > 60) {
      res.setHeader(
        "Retry-After",
        String(Math.ceil((bucket.until - now) / 1000)),
      );
      return res
        .status(429)
        .json({ error: "Too many sign-in attempts. Try again later." });
    }
    next();
  };
  const sessionOf = (req: Request) => {
    const token = req.cookies?.[COOKIE];
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
      ? { token, account: store.session(token) }
      : null;
  };
  const authenticate = (requireAccountHint: boolean) => (req: Request, res: Response, next: NextFunction) => {
    const account = sessionOf(req)?.account;
    if (!account)
      return res.status(401).json({ error: "Sign in to access your data" });
    if (requireAccountHint && req.get("X-Forma-Account") !== account.id)
      return res
        .status(401)
        .json({
          error: "Account changed. Sign in again before saving.",
          code: "ACCOUNT_CHANGED",
        });
    res.locals.account = account;
    next();
  };
  // Bind authorization to the matched route, not its spelling: Express also
  // matches case variants and trailing slashes. New private routes are bound by default.
  const auth = authenticate(true);
  // Browser images and download navigation cannot attach custom headers. The
  // read route still resolves each attachment by its session-derived owner.
  const assetReadAuth = authenticate(false);
  app.use('/api/companion', companionRouter(store, auth));
  app.use('/training-workbench', (_req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    next();
  });
  app.use('/training-workbench/api', trainingWorkbenchRouter(store, auth, secureCookies, localOrigins));
  const issueSession = (req: Request, res: Response, user: User) => {
    const previous = sessionOf(req);
    if (previous) store.deleteSession(previous.token);
    const token = randomBytes(32).toString("hex");
    store.createSession(user.id, token, Date.now() + SESSION_MS);
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_MS });
  };
  app.get("/api/capabilities", (_req, res) =>
    res.json(foodPhoto.capabilities()),
  );
  app.post('/api/food-photo-drafts', auth, async (req, res) => {
    if (req.body?.consent !== true) throw new AiError('AI_CONSENT_REQUIRED');
    const { assetId, language } = z.object({ assetId: idSchema, consent: z.literal(true), language: z.enum(['zh', 'en']) }).strict().parse(req.body);
    const asset = store.asset(res.locals.account.id, assetId);
    if (!asset) return res.status(404).json({ error: 'Attachment not found' });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(asset.mime) || asset.size > 5 * 1024 * 1024) throw new AiError('AI_IMAGE_INVALID');
    res.status(201).json(await foodPhoto.analyze(res.locals.account.id, asset, language));
  });
  app.get("/api/auth/me", (req, res) => {
    const account = sessionOf(req)?.account;
    res.json({ user: account ? publicUser(account) : null });
  });
  app.post("/api/auth/register", rateLimit, async (req, res) => {
    const { email, password, name } = registerSchema.parse(req.body);
    if (store.accountByEmail(email))
      return res
        .status(409)
        .json({ error: "An account with this email already exists" });
    const salt = randomBytes(16).toString("hex"),
      hash = await derive(password, salt);
    try {
      const user = store.createAccount(email, name, hash.toString("hex"), salt);
      issueSession(req, res, user);
      res.status(201).json({ user });
    } catch (error) {
      if (store.accountByEmail(email))
        return res
          .status(409)
          .json({ error: "An account with this email already exists" });
      throw error;
    }
  });
  app.post("/api/auth/login", rateLimit, async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const account = store.accountByEmail(email);
    if (!(await verifyPassword(password, account)))
      return res.status(401).json({ error: "Email or password is incorrect" });
    issueSession(req, res, account!);
    res.json({ user: publicUser(account!) });
  });
  app.post("/api/auth/logout", (req, res) => {
    z.object({}).strict().parse(req.body);
    const session = sessionOf(req);
    if (session?.account && req.get('X-Forma-Account') !== session.account.id)
      return res.status(401).json({
        error: 'Account changed. Sign in again before saving.',
        code: 'ACCOUNT_CHANGED',
      });
    if (session) store.deleteSession(session.token);
    res.clearCookie(COOKIE, cookieOptions);
    res.json({ ok: true });
  });
  app.get("/api/state", auth, (_req, res) =>
    res.json(store.snapshot(res.locals.account.id)),
  );
  const validateOwnedState = (ownerId: string, previous: AppState, candidate: AppState): AppState => {
    const state = parseState(candidate);
    const transitionError = validateTransition(previous, state);
    if (transitionError) throw new StateInputError(transitionError);
    for (const meal of state.meals) if (meal.source === 'ai_estimate') {
      const draft = meal.aiDraftId && store.aiDraft(ownerId, meal.aiDraftId);
      if (!draft || !draft.isFood || draft.assetId !== meal.assetId || meal.aiItemIndex === undefined || !draft.items[meal.aiItemIndex]) {
        throw new StateInputError('The AI meal must reference its genuine reviewed draft and photo');
      }
    }
    for (const assetId of referencedAssets(state)) {
      const asset = store.asset(ownerId, assetId);
      if (!asset || (state.meals.some(meal => meal.assetId === assetId) && !asset.mime.startsWith('image/'))) {
        throw new StateInputError('An attachment is unavailable or invalid for this account');
      }
    }
    return state;
  };
  const cleanRemovedAssets = (ownerId: string, previous: AppState, next: AppState) => {
    const kept = referencedAssets(next);
    for (const assetId of referencedAssets(previous)) if (!kept.has(assetId)) {
      foodPhoto.cancelAsset(ownerId, assetId);
      store.deleteAsset(ownerId, assetId);
    }
  };
  // Consumes only the intents this mutation's commit recorded; a replay of the same receipt resumes them.
  const finishMutationCleanup = (ownerId: string, mutationId: string) => {
    for (const assetId of store.assetCleanupIntents(ownerId, mutationId)) {
      foodPhoto.cancelAsset(ownerId, assetId);
      store.completeAssetCleanup(ownerId, mutationId, assetId);
    }
  };
  app.get('/api/sync', auth, (_req, res) => res.json(store.syncSnapshot(res.locals.account.id)));
  app.post('/api/sync', auth, (req, res) => {
    const mutation = syncMutationSchema.parse(req.body) as SyncMutation;
    const ownerId: string = res.locals.account.id;
    const result = store.sync(ownerId, mutation, (previous, next) => validateOwnedState(ownerId, previous, next));
    finishMutationCleanup(ownerId, mutation.mutationId);
    res.json(result.snapshot);
  });
  app.put("/api/state", auth, (req, res) => {
    const ownerId: string = res.locals.account.id;
    const snapshot = store.snapshot(ownerId);
    let body = req.body;
    if (body?.state && typeof body.state === 'object' && !Array.isArray(body.state)) {
      const compatible = { ...body.state };
      // An older snapshot writer does not know these collections; absence is not deletion.
      for (const collection of ['routines', 'schedules', 'activeWorkouts'] as const)
        if (!Object.hasOwn(compatible, collection)) compatible[collection] = snapshot.state[collection] ?? [];
      body = { ...body, state: compatible };
    }
    const { state: parsed, revision } = putStateSchema.parse(body);
    const state = parsed as AppState;
    if (snapshot.revision !== revision)
      return res
        .status(409)
        .json({
          error: "Your data changed in another window. Reload before saving.",
          revision: snapshot.revision,
        });
    validateOwnedState(ownerId, snapshot.state, state);
    if (!store.save(ownerId, state, revision))
      return res
        .status(409)
        .json({ error: "Your data changed. Reload before saving." });
    cleanRemovedAssets(ownerId, snapshot.state, state);
    res.json({ state, revision: revision + 1 });
  });
  app.post("/api/assets", auth, (req, res) => {
    const { name, mime, base64 } = uploadSchema.parse(req.body);
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length > MAX_ASSET_BYTES)
      return res
        .status(413)
        .json({ error: "Attachments must be 10 MB or smaller" });
    if (bytes.toString("base64") !== base64 || !matchesMagic(bytes, mime))
      return res
        .status(400)
        .json({ error: "File content does not match its supported type" });
    const cleanName = name.replace(/[\\/]/g, "_");
    res
      .status(201)
      .json(store.addAsset(res.locals.account.id, cleanName, mime, bytes));
  });
  app.get("/api/assets/:id", assetReadAuth, (req, res) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success)
      return res.status(404).json({ error: "Attachment not found" });
    const asset = store.asset(res.locals.account.id, parsed.data);
    if (!asset) return res.status(404).json({ error: "Attachment not found" });
    res.setHeader("Content-Type", asset.mime);
    res.setHeader(
      "Content-Disposition",
      `${asset.mime === "application/pdf" ? "attachment" : "inline"}; filename="attachment"; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
    );
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.send(store.assetBytes(asset));
  });
  app.delete("/api/assets/:id", auth, (req, res) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success || !store.asset(res.locals.account.id, parsed.data))
      return res.status(404).json({ error: "Attachment not found" });
    if (
      referencedAssets(store.snapshot(res.locals.account.id).state).has(
        parsed.data,
      )
    )
      return res
        .status(409)
        .json({ error: "Remove this attachment from its record first" });
    foodPhoto.cancelAsset(res.locals.account.id, parsed.data);
    store.deleteAsset(res.locals.account.id, parsed.data);
    res.json({ ok: true });
  });
  app.get("/api/export", auth, (_req, res) => {
    const account: Account = res.locals.account,
      snapshot = store.syncSnapshot(account.id);
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="forma-export.json"',
    );
    res.json({
      format: "forma-export",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      user: publicUser(account),
      ...snapshot,
      assets: store
        .assets(account.id)
        .map((asset) => ({
          id: asset.id,
          name: asset.name,
          mime: asset.mime,
          size: asset.size,
          createdAt: asset.created_at,
        })),
      aiDrafts: store.aiDrafts(account.id),
      aiUsage: store.aiUsage(account.id),
      aiReservations: store.aiReservations(account.id),
      trainingWorkbench: store.exportWorkbench(account.id),
      companion: store.exportCompanion(account.id),
    });
  });
  app.delete("/api/account", auth, rateLimit, async (req, res) => {
    const { password } = passwordSchema.parse(req.body),
      account: Account = res.locals.account;
    if (!(await verifyPassword(password, account)))
      return res.status(401).json({ error: "Password is incorrect" });
    foodPhoto.cancelAccount(account.id);
    store.deleteAccount(account.id);
    res.clearCookie(COOKIE, cookieOptions);
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  if (options.distDir && existsSync(join(options.distDir, "index.html"))) {
    const dist = resolve(options.distDir);
    const workbenchDist = join(dist, 'training-workbench');
    if (existsSync(join(workbenchDist, 'index.html'))) {
      app.use('/training-workbench', express.static(workbenchDist, { dotfiles: 'deny', index: 'index.html' }));
      app.get('/training-workbench/{*path}', (_req, res) => res.status(404).send('Training resource not found'));
    }
    app.use(express.static(dist, { dotfiles: "deny", index: false }));
    app.get("/{*path}", (_req, res) => res.sendFile("index.html", { root: dist }));
  }
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof CompanionError) {
        if (error.retryAfter !== undefined) res.setHeader('Retry-After', String(error.retryAfter));
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      if (error instanceof WorkbenchConflict) return res.status(409).json({ error: 'conflict', code: error.code, ...error.snapshot });
      if (error instanceof WorkbenchError) return res.status(error.status).json({ error: error.message, code: error.code });
      if (error instanceof SyncConflict) return res.status(409).json({ error: error.message, code: 'SYNC_CONFLICT', snapshot: error.snapshot, conflicts: error.conflicts });
      if (error instanceof StateInputError) return res.status(400).json({ error: error.message });
      if (error instanceof AiError) return res.status(error.status).json({ error: error.message, code: error.code });
      if (error instanceof ZodError)
        return res
          .status(400)
          .json({
            error: "Invalid input",
            issues: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          });
      const failure = error as { type?: string; status?: number };
      if (failure.type === "entity.too.large")
        return res.status(413).json({ error: "Request is too large" });
      if (failure.status === 400)
        return res.status(400).json({ error: "Invalid JSON body" });
      // Do not log request bodies, health values, passwords, session tokens or SQL contents.
      res
        .status(500)
        .json({ error: "The local server could not complete this request" });
    },
  );
  return { app, store, close: () => store.close() };
}
