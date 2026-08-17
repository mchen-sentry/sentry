# Pawn Patrol — Sentry-as-a-chess-product (hackweek prototype)

## Vision

Take the REAL Sentry/getsentry frontend and turn it into a gag chess product with
minimal edits. Sentry's product offerings map to chess concepts, all backed by
STUBBED data. It must look and feel exactly like Sentry (same chrome, same design
system) — the joke is that the content is chess. Twists and enhancements that make
it feel more alive are welcome, as long as they stay inside Sentry's design
language.

Product mapping (the joke):
- Issues → finished games ("PAWN-MORTEM-123"), severity = how blunder-filled the game was.
  Issue titles like "Blunder: Qg5?? hung the queen — room A4V2EG".
- Seer → "Grandmaster Seer", an AI chess coach that reviews games (gag drawer).
- Replays → game replays; a replay detail shows an animated chessboard stepping
  through the moves (this is a desired twist, not literal rrweb).
- Insights/Dashboards → chess analytics: accuracy trends, blunder rate, openings.
- Alerts → "blunder alerts". Releases → "openings". Uptime → "clock flags". Cheap
  renames where visible in nav/copy are enough; don't rebuild those products.
- Brand: "Pawn Patrol" wordmark + knight mark in the sidebar where "Sentry" appears.
  Keep Sentry's purple/design tokens — this should look like a legit Sentry product.

## Architecture (agreed, do not deviate)

This repo runs in pure-client mode with NO backend:

    SENTRY_UI_DEV_ONLY=1 pnpm dev-ui       # rspack dev server, auto-picks port from 7999

All data comes from a chess-mode interception layer on the central API client
(`static/app/api.tsx`). Contract:

- New directory: `static/app/chessMode/`
  - `static/app/chessMode/registry.tsx` — owned by agent CORE. Exposes:
      - `type ChessRoute = {method?: string; url: RegExp; handler: (url: string, options: any) => any}`
      - loads every `static/app/chessMode/domains/*.tsx` module via
        `require.context('./domains', false, /\.tsx$/)`; each domain module
        `export default ChessRoute[]`.
      - First matching route wins; unmatched API calls fall through to a
        sensible empty/404 default (never the network).
  - `static/app/chessMode/domains/<name>.tsx` — owned per-agent, see ownership.
- CORE wires interception + app bootstrap (config, org/projects preload, login
  bypass) so the SPA boots straight into the org without a backend.
- Org slug: `pawn-patrol`. Project: `chess` (platform javascript). User:
  "Magnus Sentry" <magnus@pawn-patrol.dev>.
- Use the repo's existing test fixture factories for realistic API shapes
  (`tests/js/fixtures/*`, importable as `sentry-fixture/*` in tests — copy the
  shapes you need into your domain file rather than importing test-only paths
  if the alias doesn't resolve in the app bundle).

## File ownership (no collisions)

- CORE — `static/app/chessMode/registry.tsx`, edits to `static/app/api.tsx`
  (interception hook, keep it to a few lines), bootstrap/config/login-bypass
  edits, `static/app/chessMode/domains/core.tsx` (org, projects, user, broad
  catch-alls: /organizations/, /projects/, client-config, prompts, assistant,
  broadcasts, etc.).
- GAMES — `static/app/chessMode/domains/games.tsx` (issue stream + issue detail
  + events + tags for games-as-issues; ~25 varied realistic games) and minimal
  copy edits inside issues views if needed.
- REPLAYS — `static/app/chessMode/domains/replays.tsx` +
  `static/app/chessMode/domains/insights.tsx` (replays index/detail, dashboards/
  insights stats) + the animated chessboard replay twist (new components under
  `static/app/chessMode/components/`).
- BRAND — `static/app/chessMode/domains/seer.tsx` (Seer/autofix endpoints →
  chess-coach content; an `openRouterClient.tsx` that calls OpenRouter if
  `OPENROUTER_API_KEY`-style config is present, else returns canned coach
  responses), plus branding edits: sidebar wordmark/logo (knight SVG), page
  titles, nav label renames. Open-source chess piece SVGs (e.g. Wikimedia
  standard pieces, cc-licensed) may be vendored under
  `static/app/chessMode/assets/` with a LICENSE note.

## Rules

- Minimal diffs to existing Sentry files; put new code in `static/app/chessMode/`.
- Match Sentry's design system (use existing components: Panel, Button, theme
  tokens, `@emotion/styled`). No new npm dependencies. No network calls.
- Do NOT run `git commit` (the orchestrator commits). Do not touch files owned
  by another agent. Shared file `static/app/api.tsx` is CORE-only.
- Verify with `pnpm dev-ui` (auto-picks a free port; hit
  `https://127.0.0.1:<port>/organizations/pawn-patrol/issues/` — note it serves
  HTTPS with a self-signed cert) or targeted `tsc`/eslint on your files.
- TypeScript must compile; prefer `any` casts over fighting exact API types in
  fixtures.
