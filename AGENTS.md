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
- **Validate every AI output** with the Zod schemas in `src/lib/contracts/schemas.ts`. If validation fails, the result is `unclear` and the raw output goes to the audit log.
- **Contracts first.** Shared types live in `src/lib/contracts`. Never redefine them in feature folders. Contract changes go through a small PR reviewed by the Platform owner.
- **Design tokens only.** No hex values and no arbitrary Tailwind values in components. Use the theme tokens in `DESIGN.md`.
- **UI copy** is sentence case, short, with no em dashes, no en dashes and no exclamation marks. Copy the text from `design/screens` unless the issue says otherwise.
- **Accessibility.** Real buttons, links, inputs and labels. Touch targets at least 44px. `aria-label` on icon-only buttons.
- **Privacy.** Families can only see their own report, by code. Names, injuries and home locations are visible only behind the responder PIN or the staff PIN.

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
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Vitest |
| `pnpm e2e` | Playwright smoke tests for the demo loop |
| `pnpm eval` | Run the AI test set, writes `eval/results.json` |
| `MOCK_AI=1 pnpm dev` | Run without Ollama, AI calls return fixtures |

## Who owns what

Work only inside your area. Changes to someone else's area go through a PR they review.

| Area | Owner | Paths |
|---|---|---|
| Platform and AI | CJ | `src/lib/**`, `src/db/**`, `src/app/api/**`, `src/components/ui/**`, `scripts/**`, `infra/**`, `package.json`, `globals.css` |
| Family app | Teammate A | `src/app/(family)/**`, `src/components/family/**` |
| Responder app | Teammate B | `src/app/r/**`, `src/components/responder/**` |
| Hub | Teammate C | `src/app/hub/**`, `src/components/hub/**`, `src/components/map/**`, `src/lib/hub/**` (summary queries) |

Only the Platform owner adds dependencies. Ask in the PR or in chat.

## How work flows

- One Linear issue, one branch, one PR. Use the branch name Linear gives you.
- Conventional commits with the issue ID, for example `feat(family): home screen BYT-12`.
- Small PRs. Rebase on main before merging. Main must always build.
- **Done means** the acceptance criteria in `docs/ISSUES.md` pass, `pnpm typecheck && pnpm test` pass, the screen matches its PNG at 390px for phones or 1440px for the hub, and you ran it yourself.
- Evidence before assertions. Put the command output or a screenshot in the PR.
