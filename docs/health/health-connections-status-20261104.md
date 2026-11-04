# HealthConnections status · 2026-11-04

Branch `claude/health-connections-20261104` from `origin/main` 7017064. Synthetic data only; no provider credentials, real health accounts, HealthKit runs or paid services were used.

## What already existed on main

- **Server** (`server/health/`, wired in `server/app.ts`): Zod-validated, session + `X-Forma-Account` protected routes `GET /api/health/connections`, `GET /api/health/records`, `POST /api/health/:provider/{connect,sync,disconnect}`, `DELETE /api/health/:provider/records`, `POST /api/health/apple-health/import`, and the `/integrations/:provider/callback` OAuth callback. WHOOP/Oura/Google Health OAuth (state, Lax binding cookie, S256 PKCE), AES-256-GCM token storage, refresh rotation, bounded polling, Apple `syncRevision`, account cascade/export. Missing credentials or token key → `not_configured` and 503 `HEALTH_NOT_CONFIGURED`.
- **Web** (`src/health.ts`, `src/features/HealthConnections.tsx` in Settings): provider cards, connect/sync/disconnect/delete/review flows, demo gate, account-change epoch/abort handling, zh/en copy.
- **Tests**: `server/health.test.ts`, `tests/health-integrations.test.ts` (independent QA, mock transport).
- **Docs**: `docs/architecture/health-integrations-20261023.md`, `docs/reviews/health-integrations-20261023.md`, `docs/health/apple-health-setup.md`.

## Gaps found and fixed on this branch

| Gap | Fix |
|---|---|
| OAuth callback result page was English-only and showed one generic failure for denial, missing config, unlinked Google Health profile and expiry | `src/health-copy.ts` `callbackPage()` — static zh/en pages per outcome, no tokens/codes/provider text; `server/health/router.ts` uses it |
| Badges showed `—` during loading and after a failed load (no loading / unavailable state) | `healthViewState()` adds `loading` and `unavailable`; component starts in loading for signed-in accounts |
| `not_configured` only showed a short badge; nothing said the server owner must configure it | Card hint explains that the server lacks developer credentials and that this is not an account problem; Connect stays disabled |
| Connected with zero records and Apple with nothing uploaded had no empty state | Empty-state hints for both |
| Action errors and `lastError` codes (sync busy, reauthorize, permission, rate limit, timeout, invalid response…) all collapsed to one generic message | Code-specific zh/en messages, generic fallback for unknown codes |
| No UI-level or "unconfigured server" HTTP tests | `tests/health-connections-ui.test.ts`: copy completeness, SSR demo/loading render in both languages, unconfigured server never reaches `connected` (connect/sync 503, callback 503 bilingual page), Zod rejection of unknown provider/body/query fields, cross-account record isolation |

## Needs credentials or owner decisions (not done, intentionally)

- WHOOP / Oura / Google Health developer apps, client ID/secret, `FORMA_HEALTH_TOKEN_KEY` and an approved HTTPS `FORMA_HEALTH_PUBLIC_BASE_URL` callback. Until set, the UI shows "Not configured on this server".
- Provider app review/approval, privacy policy and production HTTPS site.
- Apple Health: Apple developer team, HealthKit entitlement signing and a real iPhone (not attempted here).
- Whether the callback should redirect back into the SPA instead of rendering a static page (kept static to preserve the existing tested status codes).
- Full `npm run build` needs the licensed exercise-media release package (`prebuild` asset check); not available in this container.
