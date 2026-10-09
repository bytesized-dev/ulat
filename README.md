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
| Ollama | 0.40.2 was tested | Runs the local model |
| Model | `gemma4:e4b`, about 9.5 GB | Reads photos and voice notes, translates updates |
| ffmpeg | Any recent build, `brew install ffmpeg` | Turns voice notes into the WAV the model reads |

```
ollama pull gemma4:e4b
```

### Run it in development

```
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

Open http://localhost:3000. `pnpm db:push` creates the SQLite file at `data/ulat.db`. `pnpm db:seed` loads `seed/config.json`: the town, its barangays, the map bounds, the staff PIN and the responder accounts. It adds no reports or entries, so the hub starts empty. Every AI call goes to the real model, so start Ollama first. Pass `-p 4000` to `pnpm dev` to use another port.

### Run the built app

```
pnpm install
pnpm db:push
pnpm db:seed
NODE_ENV=production pnpm build
pnpm start
```

Start Ollama (`ollama serve`, or the desktop app) before the app. The app reads `OLLAMA_URL` and defaults to `http://localhost:11434`. `.env.example` lists every setting, and none are required.

- **Why `NODE_ENV=production` on the build.** If your shell exports `NODE_ENV=development`, `pnpm build` fails while prerendering `/_global-error`. Setting it to production, or running `unset NODE_ENV`, fixes it. `pnpm start` with a non-standard `NODE_ENV` only prints a warning.
- **Fonts.** `pnpm build` downloads the Inter and JetBrains Mono fonts through `next/font`, so run it while online. The fonts are bundled into the build and served from the hub.
- **Offline phone queue.** Families can save a report on the phone when the hub is out of reach, and it sends later. That needs the service worker, which the app registers only in a production build served over HTTPS or from `localhost`.
- **Clearing data.** Clear data on `/hub/setup` deletes every report, entry, update and upload, and keeps the settings and accounts. `pnpm db:seed` never deletes anything, so run it again whenever `seed/config.json` changes.

### Where to go

Sign ins live in `seed/config.json`, and the database stores only their hashes. The staff PIN is `1234`. Each responder has an account and they all use the password `ulat2026`: CJ Jutba `cjjutba@gmail.com`, Artkin Carreon `artkin@gmail.com`, Sean Jacinto `sean@gmail.com` and James Calunsag `james@gmail.com`. After pulling a change that adds columns, run `pnpm db:push` and then `pnpm db:seed`, because accounts already in your database have no password until the config reloads.

| Route | Who | Sign in |
|---|---|---|
| `/` | Families, home | None |
| `/report`, then `/report/voice` or `/report/type`, `/report/check`, `/report/location`, `/report/send`, `/report/sent` | Families, send a report by voice or typing | None |
| `/status` | Families, check a report with its 4 character code | None |
| `/updates`, `/map`, `/safe`, `/safe/done` | Families, updates from the MDRRMO, map of relief points, shelters and hazards, "I'm safe" check in | None |
| `/r` | Responders, redirects to `/r/sign-in` | Email and password |
| `/r/queue`, `/r/map`, `/r/new`, `/r/done`, `/r/reports/<code>` | Responders, visit queue, map, a house nobody reported, done list, one family report. The photo flow lives under `/r/assess/<entry id>` | Responder sign in |
| `/hub` | MDRRMO staff on the laptop, redirects to `/hub/lock` | Staff PIN |
| `/hub/review`, `/hub/review/family-reports`, `/hub/review/duplicates` | Review of drafted entries, family reports and assigning, possible duplicates | Staff PIN |
| `/hub/entries`, `/hub/entries/<id>` | All entries and one entry | Staff PIN |
| `/hub/map`, `/hub/map/add` | Hub map and adding a point | Staff PIN |
| `/hub/reports`, `/hub/reports/<n>/print` | Situation report, SMS summary and CSV export, and the numbered report on one A4 page. The print page exists after you save a report, and "Print" on `/hub/reports` opens the latest one | Staff PIN |
| `/hub/poster` | The join poster on one A4 page, with a QR code for the hub address. "Print poster" on `/hub` and "Print" on `/hub/setup` open it | Staff PIN |
| `/hub/desk`, `/hub/safe-list`, `/hub/updates` | Help desk, safe list, post an update | Staff PIN |
| `/hub/setup`, `/hub/checklist`, `/hub/ai-check` | Kit setup, the before the storm checklist, and the numbers `pnpm eval` wrote | Staff PIN |

Three screens print, each through the browser's print dialog. The join poster at `/hub/poster` and the situation report at `/hub/reports/<n>/print` are A4 pages with no hub chrome and a Print button. "Save and print slip" on `/hub/desk` prints the family code slip.

### Other commands

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Vitest unit and rule tests |
| `pnpm eval` | Runs the AI test set against the real model and writes `eval/results.json` |
| `pnpm eval --repeat 100` | Loops the photo set until 100 photo calls are done. Use it for the battery test |
| `node scripts/check-eval.mjs` | Lists what the eval set is still missing |
| `pnpm db:seed` | Loads `seed/config.json`, the settings and responder accounts. Deletes nothing |
| `pnpm db:push` | Creates or updates the SQLite schema |

The eval method, labels and photo sources are in `eval/README.md`. The eval set is a work in progress. It has 10 photos with one set of labels and no voice recordings yet, so `pnpm eval` has no final numbers.

### Field setup

For the router, the Caddy certificate, local DNS and the Mac and Windows start scripts, see `infra/README.md`. Phones with no mobile data join the hub's Wi-Fi and open the hub's address. The camera, microphone and GPS need HTTPS, which Caddy provides.

## Disclosures

Required by the hackathon rules. This list is complete.

### Models

- **Gemma 4 E4B** (`gemma4:e4b`) through Ollama, running on the hub laptop. Used for photo to damage class, voice and text to form fields, and translation of updates to Bisaya and Tagalog. The code calls Ollama's `/api/chat` and nothing else. The model's license, as `ollama show gemma4:e4b --license` reports it, is the Apache License 2.0. Ollama is MIT licensed.
- **Audio** goes to Gemma natively through Ollama. Ollama reads only WAV, so the hub converts each recording to 16 kHz mono WAV with ffmpeg first. whisper.cpp is not in the code and not installed. It is the documented fallback in `docs/SPEC.md`, used only if the final recording test fails.
- No other model, and no hosted AI. The app makes no request to any host outside the hub.

### AI coding tools

- **Claude Code**, with Claude Opus 5.5 and Claude Sonnet 5.5, used to write code, tests and docs. The `Co-Authored-By` lines in commits mark that work.
- **Claude on claude.ai** made the design canvas (https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH), the source of every screen. `design/screens` and `design/png` are its exports, and the app screens were built from them.
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
- **App fonts.** [Inter](https://github.com/rsms/inter) and [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) (weight 500 only) from Google Fonts, both SIL Open Font License 1.1. `next/font` downloads them at build time and serves them from the hub.
- **Design exports.** `design/screens` and `design/png` are exports of the design canvas made with Claude. The HTML files link Google Fonts for viewing only. The app does not use them at runtime.
- **Seed config.** `seed/config.json` holds the hub settings and the team's accounts. The barangay names are the real barangays of Dapitan City.
- **Damage definitions.** The photo prompt uses the DSWD definitions of partially and totally damaged houses from DSWD Memorandum Circular 2020-032.

### Kit tools

The field kit in `infra/`, the map script in `scripts/map` and the voice note conversion use these programs. None are bundled in the repo or the app. Each license is from the LICENSE or COPYING file of that project.

| Tool | License | Used for |
|---|---|---|
| [Caddy](https://github.com/caddyserver/caddy) | Apache-2.0 | HTTPS in front of the app, `infra/Caddyfile` and the start scripts |
| [dnsmasq](https://thekelleys.org.uk/dnsmasq/doc.html) | GPL v2 or v3, at your option | Local DNS so phones find the hub, `infra/dnsmasq.conf`. Windows and Macs without it use `infra/dns-stub.mjs`, written for Ulat |
| [Certbot](https://github.com/certbot/certbot) | Apache-2.0 | Gets the Let's Encrypt certificate before the storm, see `infra/README.md` |
| [Let's Encrypt](https://letsencrypt.org) | A free certificate service, no software copied | Issues the certificate Certbot asks for. Needs the internet once, before the storm |
| [go-pmtiles](https://github.com/protomaps/go-pmtiles) | BSD-3-Clause | The `pmtiles` command that cut `town.pmtiles`, run by `scripts/map/fetch-map.sh` |
| [FFmpeg](https://ffmpeg.org) | LGPL 2.1 or later, with optional parts under GPL 2 or later | Converts each voice note to 16 kHz WAV for the model, `src/lib/ai/audio.ts`. The app runs it as a separate program on the hub |

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
| qrcode | MIT | Draws the QR code on the join poster as inline SVG, on the server |
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
| @types/node, @types/react, @types/react-dom, @types/better-sqlite3, @types/qrcode | MIT | Type definitions |
| vitest | MIT | Unit and rule tests |
| @playwright/test | Apache-2.0 | `npx playwright screenshot` for pull request screenshots |
| eslint, eslint-config-next | MIT | Linting |
| drizzle-kit | MIT | `pnpm db:push` |
| tsx | MIT | Runs `db:seed` and `eval` |
| dotenv | BSD-2-Clause | Loads `.env.local` in the test setup |

## Team

ByteSized:

- CJ Jutba
- Artkin Carreon
- James Vincent Calunsag
- Sean Myk Daniel B. Jacinto
