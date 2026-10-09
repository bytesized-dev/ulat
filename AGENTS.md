# Ulat: rules for every agent and teammate

Ulat is an offline disaster damage reporting kit for Philippine LGUs. One laptop, the hub, runs the web app, the database and a local AI model. Families, responders and MDRRMO staff use it from phones and the laptop over a local Wi-Fi network with no internet.

**Design canvas, the source of truth for UI:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH

The canvas is private to its owner's claude.ai account, so agents cannot open it. Every screen is exported in `design/screens` as standalone HTML and in `design/png` as a screenshot. Use those.

## Read before you start

1. `docs/BRIEF.md` for what and why. Skim it once.
2. `docs/SPEC.md` for what to build. Read the section your issue points to.
3. `DESIGN.md` for tokens and components. Required for any UI work.
4. `docs/ISSUES.md` for your issue's acceptance criteria and `docs/PLAN.md` for order.
5. The screen itself. Run `node scripts/screen-outline.mjs design/screens/<app>/<screen>.html` for its structure and copy, and look at `design/png/<app>/<screen>.png` for the layout. The raw HTML is mostly mockup CSS, so skip it. `design/README.md` maps every screen to its route and issue.

## Hard rules

- **Offline first.** Nothing loads from the internet at runtime. No CDNs, no Google Fonts links, no remote images, no remote map tiles. Fonts come from `next/font`, which downloads them at build time. Map tiles, glyphs and sprites are served from `public/map`.
- **No cloud in the request path.** No Neon, no Supabase, no hosted auth, no hosted AI. The database is SQLite through Drizzle and better-sqlite3. The AI runs in Ollama on the hub.
- **The model reads, the code counts.** AI only extracts fields from one house or one note. Every total, ranking and report number is computed in SQL or TypeScript from confirmed entries. Never ask the model to count, add up or rank.
- **Families report, responders verify, only verified entries count.** Family reports never change the totals.
- **Validate every AI output** with the Zod schemas in `src/lib/contracts/schemas.ts`. If validation fails, the raw output goes to the audit log, and a photo becomes `unclear` while voice and translate return 502 `invalid_output` with `retry: true`.
- **Contracts first.** Shared types live in `src/lib/contracts`. Never redefine them in feature folders. Contract changes go through a small PR reviewed by the Platform owner.
- **Design tokens only.** No hex values and no arbitrary Tailwind values in components. Use the theme tokens in `DESIGN.md`. The only exception is the few values in the vendored shadcn files of `src/components/ui` that have no token or scale equivalent, which the `vendored` list in `tests/rules/no-raw-values.test.ts` names.
- **UI copy** is sentence case, short, with no em dashes, no en dashes and no exclamation marks. Copy the text from `design/screens` unless the issue says otherwise.
- **Accessibility.** Real buttons, links, inputs and labels. Touch targets at least 44px. `aria-label` on icon-only buttons.
- **Privacy.** Families can only see their own report, by code. Names, injuries and home locations are visible only behind a responder sign in or the staff PIN.

## Stack

- Next.js from the team starter kit, App Router, TypeScript strict
- Tailwind 4 and shadcn/ui, themed with the tokens in `DESIGN.md`
- SQLite with Drizzle and better-sqlite3, file at `data/ulat.db`
- Zod for every boundary
- Ollama with `gemma4:e4b` for photos, voice and translation. whisper.cpp only if Ollama audio fails the risk check.
- MapLibre GL with a local PMTiles file
- Server-sent events for live updates
- Vitest for unit tests, Playwright for smoke tests

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app on port 3000 |
| `pnpm db:push` | Create or update the SQLite schema |
| `pnpm db:seed` | Load `seed/simulation.json`, the same data the canvas shows |
| `pnpm demo:reset` | Wipe data and uploads, reload the seed, turn simulation on |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Vitest |
| `pnpm e2e` | Playwright smoke tests for the demo loop |
| `pnpm eval` | Run the AI test set, writes `eval/results.json` |
| `MOCK_AI=1 pnpm dev` | Run without Ollama, AI calls return fixtures |

## Who owns what

Work only inside your area. Changes to someone else's area go through a PR they review.

| Area | Owner | Paths |
|---|---|---|
| Platform and AI | CJ | `src/lib/**` except `src/lib/hub`, `src/db/**`, `src/components/ui/**`, `scripts/**`, `infra/**`, `package.json`, `globals.css`. APIs: `src/app/api/ai/**`, `auth/**`, `events/**`, `health/**`, `hub/status/**`, `updates/translate/**` |
| Family app | Artkin | `src/app/(family)/**`, `src/components/family/**`. APIs: `src/app/api/reports/**` |
| Responder app | James | `src/app/r/**`, `src/components/responder/**`. APIs: `src/app/api/entries/**`, `src/app/api/files/**` |
| Hub | Sean | `src/app/hub/**`, `src/components/hub/**`, `src/components/map/**`, `src/lib/hub/**`. APIs: `src/app/api/hub/summary/**`, `updates/**` except translate, `places/**`, `safe/**`, `sitreps/**`, `export/**` |

Each API belongs to the app that writes its data. Route handlers use the schema and contracts from CJ's area and never redefine them.

Known crossings, each named in its Linear issue:

- Sean builds `src/app/api/reports/[code]/assign` in BYT-28 and James builds `src/app/api/reports/[code]/cant-assess` in BYT-53. Artkin reviews both.
- Artkin writes the HTTPS start script in `infra/` for BYT-2. CJ reviews it.

Only the Platform owner adds dependencies. Ask in the PR or in chat.

## How work flows

- One Linear issue, one branch, one PR. Use the branch name Linear gives you.
- Conventional commits with the issue ID, for example `feat(family): home screen BYT-21`.
- Small PRs. Rebase on main before merging. Main must always build.
- Merge your own PR once the CI `check` job passes. A PR that touches the contracts, the database schema, the dependencies or `.github` also needs CJ's approval. CODEOWNERS lists those paths and requests the review.
- **Done means** the acceptance criteria in `docs/ISSUES.md` pass, `pnpm typecheck && pnpm test` pass, the screen matches its PNG at 390px for phones or 1440px for the hub, and you ran it yourself.
- Evidence before assertions. Put the command output or a screenshot in the PR.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
