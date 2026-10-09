# Ulat

Offline disaster damage reporting for LGUs. One laptop and one Wi-Fi router, no internet. Families report what happened to their homes by voice, responders verify with photos, and the MDRRMO gets a situation report within the 72-hour window. A local AI model on the laptop does the reading and drafting.

Built by team ByteSized for App Builders PH Hackathon 2026, theme Local AI.

- **Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH
- **Docs:** `docs/BRIEF.md` (why), `docs/SPEC.md` (what), `DESIGN.md` (look), `docs/PLAN.md` (how and when), `docs/WORKFLOW.md` (how the team works), `docs/ISSUES.md` (tasks)

## Run it

The laptop that runs Ulat is called the hub. Install and build need the internet once. After that the app runs with no internet at all. The steps below were run start to finish in a fresh clone on macOS 27 with Node 24.21 and pnpm 12.3.4.

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 24 (`.node-version`). `package.json` allows 22 or newer, but only 24 was tested | Runs the app |
| pnpm | 12.3.4 (`packageManager` in `package.json`) | Installs and runs scripts |
| Ollama | 0.40.2 was tested. Skip it to try the app with `MOCK_AI=1` | Runs the local model |
| Model | `gemma4:e4b`, about 9.5 GB. Skip it with `MOCK_AI=1` | Reads photos and voice notes, translates updates |

```
ollama pull gemma4:e4b
```

### Try it in two minutes, without the model

```
pnpm install
pnpm db:push
pnpm demo:reset
MOCK_AI=1 pnpm dev
```

Open http://localhost:3000. `pnpm db:push` creates the SQLite file at `data/ulat.db`. `pnpm demo:reset` wipes data and uploads, loads `seed/simulation.json` (a simulated drill in Dapitan City, 49 entries and 19 family reports) and turns simulation on. With `MOCK_AI=1`, every AI call returns a fixture from `seed/ai-fixtures.json`, so nothing needs Ollama. Pass `-p 4000` to `pnpm dev` to use another port.

Two things only work in `pnpm dev`. The component kit at `/dev/kit` and the map check at `/hub/map-check` return 404 in a production build.

### Run the built app with the real model

```
pnpm install
pnpm db:push
pnpm demo:reset
NODE_ENV=production pnpm build
pnpm start
```

Start Ollama (`ollama serve`, or the desktop app) before the app. The app reads `OLLAMA_URL` and defaults to `http://localhost:11434`. `.env.example` lists every setting, and none are required. Use `MOCK_AI=1 pnpm start` to run the built app without Ollama.

- **Why `NODE_ENV=production` on the build.** If your shell exports `NODE_ENV=development`, `pnpm build` fails while prerendering `/_global-error`. Setting it to production, or running `unset NODE_ENV`, fixes it. `pnpm start` with a non-standard `NODE_ENV` only prints a warning.
- **Fonts.** `pnpm build` downloads the Inter and JetBrains Mono fonts through `next/font`, so run it while online. The fonts are bundled into the build and served from the hub.
- **Offline phone queue.** Families can save a report on the phone when the hub is out of reach, and it sends later. That needs the service worker, which the app registers only in a production build served over HTTPS or from `localhost`.
- **Reset between runs.** Stop the app, run `pnpm demo:reset`, start it again. `pnpm db:seed` loads the seed file without the wipe.

### Where to go

Seeded PINs live in `seed/simulation.json` under `settings`, and the database stores only their hashes. The team PIN is `123456` and the staff PIN is `1234`. Seeded responders are Mae Santos, Jun Reyes, Carlo Mendoza, Ana Villanueva and Lito Bautista, and they all share the team PIN.

| Route | Who | Sign in |
|---|---|---|
| `/` | Families, home | None |
| `/report`, then `/report/voice` or `/report/type`, `/report/check`, `/report/location`, `/report/send`, `/report/sent` | Families, send a report by voice or typing | None |
| `/status` | Families, check a report with its 4 character code. `K7P4` is in the seed | None |
| `/updates`, `/map`, `/safe`, `/safe/done` | Families, updates from the MDRRMO, map of relief points, shelters and hazards, "I'm safe" check in | None |
| `/r` | Responders, redirects to `/r/sign-in` | Pick a name and enter the team PIN |
| `/r/queue`, `/r/map`, `/r/new`, `/r/done`, `/r/reports/K7P4` | Responders, visit queue, map, a house nobody reported, done list, one family report. The photo flow lives under `/r/assess/<entry id>` | Team PIN |
| `/hub` | MDRRMO staff on the laptop, redirects to `/hub/lock` | Staff PIN |
| `/hub/review`, `/hub/review/family-reports`, `/hub/review/duplicates` | Review of drafted entries, family reports and assigning, possible duplicates | Staff PIN |
| `/hub/entries`, `/hub/entries/<id>` | All entries and one entry | Staff PIN |
| `/hub/map`, `/hub/map/add` | Hub map and adding a point | Staff PIN |
| `/hub/reports` | Situation report, SMS summary and CSV export | Staff PIN |
| `/hub/desk`, `/hub/safe-list`, `/hub/updates` | Help desk, safe list, post an update | Staff PIN |
| `/hub/setup`, `/hub/checklist`, `/hub/ai-check` | Kit setup, the before the storm checklist, and the numbers `pnpm eval` wrote | Staff PIN |
| `/dev/kit`, `/hub/map-check` | Component kit and map check, `pnpm dev` only | None for `/dev/kit`, staff PIN for `/hub/map-check` |

There are no separate print routes. Printing is a browser print from the buttons on `/hub` ("Print poster"), `/hub/setup` ("Print") and `/hub/desk` ("Save and print slip").

### Other commands

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Vitest unit and rule tests |
| `pnpm e2e` | Playwright smoke test of the demo loop. `tests/e2e` has no tests yet, so it exits with "No tests found". Run `pnpm exec playwright install chromium` once before the first real test |
| `pnpm eval` | Runs the AI test set against the real model and writes `eval/results.json`. It refuses to run with `MOCK_AI=1` |
| `pnpm eval --repeat 100` | Loops the photo set until 100 photo calls are done. Use it for the battery test |
| `node scripts/check-eval.mjs` | Lists what the eval set is still missing |
| `pnpm demo:reset` | Wipes data and uploads, reloads the seed and turns simulation on |
| `pnpm db:seed` | Loads `seed/simulation.json` |
| `pnpm db:push` | Creates or updates the SQLite schema |

The eval method, labels and photo sources are in `eval/README.md`. The eval set is a work in progress. It has 10 photos with one set of labels and no voice recordings yet, so `pnpm eval` has no final numbers.

### Field setup

For the router, the Caddy certificate, local DNS and the Mac and Windows start scripts, see `infra/README.md`. Phones with no mobile data join the hub's Wi-Fi and open the hub's address. The camera, microphone and GPS need HTTPS, which Caddy provides.

## Disclosures

Required by the hackathon rules. This list is complete.

### Models

- **Gemma 4 E4B** (`gemma4:e4b`) through Ollama, running on the hub laptop. Used for photo to damage class, voice and text to form fields, and translation of updates to Bisaya and Tagalog. The code calls Ollama's `/api/chat` and nothing else. The model's license, as `ollama show gemma4:e4b --license` reports it, is the Apache License 2.0. Ollama is MIT licensed.
- **Audio** goes to Gemma natively through Ollama. whisper.cpp is not in the code and not installed. It is the documented fallback in `docs/SPEC.md`, used only if the final recording test fails.
- No other model, and no hosted AI. The app makes no request to any host outside the hub.

### AI coding tools

- **Claude Code**, with Claude Opus 5.5 and Claude Sonnet 5.5, used to write code, tests and docs. The `Co-Authored-By` lines in commits mark that work.
- **Kernel** orchestrated CJ's Claude Code sessions in separate git worktrees. Its agent definitions (rowan, kai, noor, ivy and theo) are in `.claude/agents` and run on Claude models.
- No other AI coding tool appears in the commit history.

### Reused code

- **Starter kit.** CJ's own starter-kit-web, for the Next.js, Tailwind and shadcn setup, the shadcn components in `src/components/ui` (avatar, badge, button, checkbox, dialog, dropdown-menu, input, label, popover, select, separator, sheet, skeleton, switch, table, tabs, textarea, tooltip), the time helpers in `src/lib/time`, the ESLint, Vitest and Playwright config, the CI workflow, and the rule tests for hex values, arbitrary values and dashes. Its auth, Postgres, mail and analytics were removed.
- **Ulat components.** The other files in `src/components/ui` were built for Ulat.
- **MapLibre worker.** `public/map/maplibre-gl-worker.mjs` is a copy of the file in `node_modules/maplibre-gl/dist`, so the map loads it from the hub. A test checks that the two match.
- **Map glyphs and sprites.** Copied from protomaps/basemaps-assets, see the next section.
- No other project's code was copied. Everything else comes from the npm packages below.

### Datasets and assets

- **Eval photos.** 10 photos from Wikimedia Commons, 960 px thumbnails. Licenses per file: 3 public domain, 1 CC0, 2 CC BY 2.0, 3 CC BY-SA 3.0 and 1 CC BY-SA 4.0. Author, source URL and license for each file are in [`eval/SOURCES.md`](eval/SOURCES.md). Seven show US tornado and hurricane damage and three show undamaged houses in the Philippines. No voice recordings are in the repo yet.
- **Map tiles.** `public/map/town.pmtiles` is OpenStreetMap data of 8 Oct 2026 under ODbL 1.0, credit "© OpenStreetMap contributors", cut for Dapitan City from a Protomaps daily build. The map style comes from Protomaps basemaps (BSD 3-Clause).
- **Map glyphs.** Noto Sans Regular, Medium, Italic and Devanagari in `public/map/fonts`, from protomaps/basemaps-assets, under the SIL Open Font License 1.1. The license text is `public/map/fonts/OFL.txt`.
- **Map sprites.** `public/map/sprites/v4`, from protomaps/basemaps-assets, MIT, derived from tangrams/icons.
- **Barangay boundaries.** `public/map/barangays.geojson`, OCHA, PSA and NAMRIA through the Humanitarian Data Exchange, Philippines Subnational Administrative Boundaries, under CC BY-IGO. Simplified to about 5 m.
- Sources, dates and sizes for every map file are in [`public/map/README.md`](public/map/README.md), and `scripts/map/fetch-map.sh` rebuilds them. Nothing in the map is fetched at runtime.
- **App fonts.** Inter and JetBrains Mono (weight 500 only) from Google Fonts, both SIL Open Font License 1.1. `next/font` downloads them at build time and serves them from the hub.
- **Design exports.** `design/screens` and `design/png` are exports of the design canvas. The HTML files link Google Fonts for viewing only. The app does not use them at runtime.
- **Seed data.** `seed/simulation.json` and `seed/ai-fixtures.json` are simulated. The households, reports, entries and people are invented. The barangay names are real barangays of Dapitan City.
- **Damage definitions.** The photo prompt uses the DSWD definitions of partially and totally damaged houses from DSWD Memorandum Circular 2020-032.

### npm dependencies

Versions are pinned in `package.json` and `pnpm-lock.yaml`. Licenses are from each package's `package.json`.

| Package | License | Used for |
|---|---|---|
| next | MIT | App framework, server and `next/font` |
| react, react-dom | MIT | UI |
| drizzle-orm | Apache-2.0 | Database queries |
| better-sqlite3 | MIT | SQLite driver |
| zod | MIT | Validation of every input and AI output |
| maplibre-gl | BSD-3-Clause | Offline map renderer |
| pmtiles | BSD-3-Clause | Reads the local tile file |
| @protomaps/basemaps | BSD-3-Clause | Map style layers |
| radix-ui | MIT | Component primitives |
| class-variance-authority | Apache-2.0 | Component variants |
| cn | MIT | Merges Tailwind class names |
| lucide-react | ISC | Icons |
| shadcn | MIT | CLI and `shadcn/tailwind.css` theme styles |
| tw-animate-css | MIT | Animation utilities for Tailwind |
| date-fns | MIT | Time formatting and math |
| @date-fns/tz | MIT | Philippine time zone for date-fns |

Dev tools, none of them shipped to the browser:

| Package | License | Used for |
|---|---|---|
| tailwindcss, @tailwindcss/postcss | MIT | Styling and the PostCSS plugin |
| typescript | Apache-2.0 | Type checking |
| @types/node, @types/react, @types/react-dom, @types/better-sqlite3 | MIT | Type definitions |
| vitest | MIT | Unit and rule tests |
| @playwright/test | Apache-2.0 | Smoke tests |
| eslint, eslint-config-next | MIT | Linting |
| drizzle-kit | MIT | `pnpm db:push` |
| tsx | MIT | Runs `db:seed`, `demo:reset` and `eval` |
| dotenv | BSD-2-Clause | Loads `.env.local` in the test setup |

## Team

ByteSized:

- CJ Jutba
- Artkin Carreon
- James Vincent Calunsag
- Sean Myk Daniel B. Jacinto
