# Ulat

Offline disaster damage reporting for LGUs. One laptop and one Wi-Fi router, no internet. Families report what happened to their homes by voice, responders verify with photos, and the MDRRMO gets a situation report within the 72-hour window. A local AI model on the laptop does the reading and drafting.

Built by team ByteSized for App Builders PH Hackathon 2026, theme Local AI.

- **Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH
- **Docs:** `docs/BRIEF.md` (why), `docs/SPEC.md` (what), `DESIGN.md` (look), `docs/PLAN.md` (how and when), `docs/WORKFLOW.md` (how the team works), `docs/ISSUES.md` (tasks)

## Run it

The laptop that runs Ulat is called the hub. Install and build need the internet once. After that the app runs with no internet at all.

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 24 (`.node-version`). `package.json` allows 22 or newer, but only 24 was tested | Runs the app |
| pnpm | 12.3.4 (`packageManager` in `package.json`) | Installs and runs scripts |
| Ollama | 0.40.2 was tested | Runs the local model |
| Model | `gemma4:e4b`, about 9.5 GB | Reads photos and voice notes, translates updates |

```
ollama pull gemma4:e4b
```

### Steps

```
pnpm install
pnpm db:push
pnpm db:seed
pnpm build
pnpm start
```

`pnpm db:push` creates the SQLite file at `data/ulat.db`. `pnpm db:seed` loads `seed/simulation.json`, a simulated drill in Dapitan City. Use `pnpm dev` instead of `pnpm build && pnpm start` while developing. Both listen on port 3000. Pass `-p 4000` to either one to use another port.

`pnpm build` downloads the Inter and JetBrains Mono fonts through `next/font`, so run it while online. The fonts are bundled into the build and served from the hub. If the build fails on `/_global-error`, run `unset NODE_ENV` and build again. Next.js expects `NODE_ENV` to be unset during `next build`.

Start Ollama (`ollama serve`, or the desktop app) before the app. The app reads `OLLAMA_URL` and defaults to `http://localhost:11434`. `.env.example` lists every setting. None are required.

### Without the model

```
MOCK_AI=1 pnpm dev
```

Every AI call returns a fixture from `seed/ai-fixtures.json`. Nothing needs Ollama. Use `MOCK_AI=1 pnpm start` for the built app.

### Where to go

| Route | Who | Sign in |
|---|---|---|
| `/` | Families | None. A family checks its report with the 4 character code, for example `K7P4` from the seed |
| `/r` | Responders | Pick a name and enter the team PIN `123456` |
| `/hub` | MDRRMO staff on the laptop | Staff PIN `1234` |

Seeded responders: Mae Santos, Jun Reyes, Carlo Mendoza, Ana Villanueva and Lito Bautista. They all share the team PIN. The seeded PINs are in `seed/simulation.json` under `settings`, and the database stores only their hashes.

### Other commands

| Command | What it does |
|---|---|
| `pnpm demo:reset` | Wipes data and uploads, reloads the seed and turns simulation on. Stop the app first or restart it after |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Vitest unit and rule tests |
| `pnpm e2e` | Playwright smoke test of the demo loop. Run `pnpm exec playwright install chromium` once first |
| `pnpm eval` | Runs the AI test set against the real model and writes `eval/results.json`. It refuses to run with `MOCK_AI=1` |
| `pnpm eval --repeat 100` | Loops the photo set until 100 photo calls are done. Use it for the battery test |

The eval method, labels and photo sources are in `eval/README.md`.

### Field setup

For the router, the Caddy certificate, local DNS and the Windows start script, see `infra/README.md`. Phones with no mobile data join the hub's Wi-Fi and open the hub's address.

## Disclosures

Required by the hackathon rules. This list is complete.

### Models

- **Gemma 4 E4B** (`gemma4:e4b`) through Ollama, running on the hub laptop. Used for photo to damage class, voice and text to form fields, and translation of updates to Bisaya and Tagalog. The model's license, as `ollama show gemma4:e4b --license` reports it, is the Apache License 2.0. Ollama is MIT licensed.
- **Audio** goes to Gemma natively through Ollama. whisper.cpp is the documented fallback and is not used unless the final audio test switches to it.
- No other model, and no hosted AI. The app makes no request to any host outside the hub.

### AI coding tools

- **Claude Code**, with Claude Opus 5.5 and Claude Sonnet 5.5, used by all four teammates to write code, tests and docs. CJ's work was orchestrated through Kernel. The co-author lines in commits and pull requests mark that work.
- No other AI coding tool was used.

### Reused code

- **Starter kit:** CJ's own starter-kit-web, for the Next.js, Tailwind and shadcn setup, the shadcn components in `src/components/ui` (avatar, badge, button, checkbox, dialog, dropdown-menu, input, label, popover, select, separator, sheet, skeleton, switch, table, tabs, textarea, tooltip), the time helpers in `src/lib/time`, the ESLint, Vitest and Playwright config, the CI workflow, and the rule tests for hex values, arbitrary values and dashes. Its auth, Postgres, mail and analytics were removed.
- The other components in `src/components/ui` were built for Ulat.
- No other project's code was copied. Everything else comes from the npm packages below.

### Datasets and assets

- **Eval photos.** 10 photos from Wikimedia Commons, 960 px thumbnails. Licenses per file: 3 public domain, 1 CC0, 2 CC BY 2.0, 3 CC BY-SA 3.0 and 1 CC BY-SA 4.0. Author, source URL and license for each file are in [`eval/SOURCES.md`](eval/SOURCES.md). Seven show US tornado and hurricane damage and three show undamaged houses in the Philippines.
- **Map data.** OpenStreetMap data under ODbL 1.0, credit "© OpenStreetMap contributors", cut into `public/map/town.pmtiles` from Protomaps basemaps (BSD 3-Clause). Glyphs are Noto Sans under the SIL Open Font License 1.1. Sprites are from protomaps/basemaps-assets (MIT).
- **Barangay boundaries.** OCHA, PSA and NAMRIA through the Humanitarian Data Exchange, Philippines Subnational Administrative Boundaries, under CC BY-IGO.
- Sources, dates and sizes for every map file are in [`public/map/README.md`](public/map/README.md). Nothing in the map is fetched at runtime.
- **App fonts.** Inter and JetBrains Mono, both SIL Open Font License 1.1, fetched once at build time.
- **Seed data.** `seed/simulation.json` is simulated. The households, reports, entries and people are invented. The barangay names are real barangays of Dapitan City.
- **Damage definitions.** The photo prompt uses the DSWD definitions of partially and totally damaged houses from DSWD Memorandum Circular 2020-032.

### npm dependencies

| Package | License | Used for |
|---|---|---|
| next | MIT | App framework |
| react, react-dom | MIT | UI |
| drizzle-orm | Apache-2.0 | Database queries |
| better-sqlite3 | MIT | SQLite driver |
| zod | MIT | Validation of every input and AI output |
| maplibre-gl | BSD 3-Clause | Offline map |
| pmtiles | BSD 3-Clause | Reads the local tile file |
| radix-ui, class-variance-authority | MIT, Apache-2.0 | Component primitives |
| lucide-react | ISC | Icons |
| tailwindcss | MIT | Styling |
| date-fns, @date-fns/tz | MIT | Time |

Dev tools: TypeScript, Vitest, Playwright, ESLint, drizzle-kit and tsx. Every dependency and version is pinned in `package.json` and `pnpm-lock.yaml`.

## Team

ByteSized:

- CJ Jutba
- Artkin Carreon
- James Vincent Calunsag
- Sean Myk Daniel B. Jacinto
