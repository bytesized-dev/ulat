# Ulat spec

**Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH. Exported screens are in `design/`. `design/README.md` maps every screen to a route, a tier and an issue.

## 1. System

### Hardware and network

- **Hub:** a MacBook running the Next.js app, SQLite, Ollama and Caddy. It runs on battery.
- **Network:** any Wi-Fi router with nothing in its internet port, powered by a power bank. Give the hub a fixed IP with a DHCP reservation. Wi-Fi name `ULAT-HUB`.
- **Phones:** any phone with a browser. Nothing to install.
- **Address:** phones open `https://hub.[your-domain]`. The router hands out the hub as the DNS server, dnsmasq on the hub answers that name with the hub's local IP, and Caddy serves a real Let's Encrypt certificate fetched before the storm with a DNS challenge. Phones trust it with no setup, so camera, microphone, GPS and offline caching all work. Details in `infra/README.md`.
- **Fallback:** if the certificate fails, Caddy's internal certificate installed on the demo phones, or plain HTTP with file inputs for photos and typed notes.

### Software

- One Next.js app, three areas: family at `/`, responder at `/r`, hub at `/hub`.
- Route handlers under `/api` are the only backend.
- SQLite file at `data/ulat.db`. Photos and audio at `data/uploads/<yyyy-mm-dd>/<uuid>.<ext>`.
- Ollama on `localhost:11434` with `gemma4:e4b`.
- Live updates over one server-sent events endpoint.
- `MOCK_AI=1` replaces every AI call with fixtures from `seed/ai-fixtures.json`, so teammates without the model can build everything.

### Roles and access

| Role | How they get in | Can see |
|---|---|---|
| Family | Opens the address | Home, their own report by code, map, updates, safe list search |
| Responder | Name plus the team PIN on `/r/sign-in` | All reports and entries, map with households |
| Hub staff | The laptop, staff PIN on `/hub/lock` after idle | Everything |

PINs are hashed in the `settings` table. Sessions are signed cookies. No accounts, no email.

## 2. Screens and routes

Tier 1 is the demo loop and must work end to end. Tier 2 makes it feel complete. Tier 3 is polish. States share a route with their parent screen.

### Family

| Route | Canvas screens | Tier |
|---|---|---|
| `/` | Family: home | 1 |
| `/report` | Family: whose household. `?for=neighbor` shows Family: report for a neighbor (tier 2) | 1 |
| `/report/voice` | Family: voice note ready, recording, reading the note, note not understood, microphone blocked | 1 |
| `/report/type` | Family: type instead | 2 |
| `/report/check` | Family: check your report, with the edit sheet and what we heard sheet (tier 2) | 1 |
| `/report/location` | Family: set home location | 1 |
| `/report/send` | Family: before you send | 1 |
| `/report/sent` | Family: report sent | 1 |
| `/status` | Family: status, waiting for visit and status, visited | 1 |
| `/map` | Family: map | 2 |
| `/updates` | Family: updates from MDRRMO | 2 |
| `/safe`, `/safe/done` | Family: I'm safe, on the safe list | 2 |
| any | Family: saved on phone, shown when the hub can't be reached | 2 |

The report draft lives in `sessionStorage` until it is sent. Tier 2 adds an IndexedDB queue so a sent report survives leaving the hub's range.

### Responder

| Route | Canvas screens | Tier |
|---|---|---|
| `/r/sign-in` | Responder: unlock | 1 |
| `/r` | Responder: to visit | 1 |
| `/r/map` | Responder: map | 2 |
| `/r/done` | Responder: done | 2 |
| `/r/queue` | Responder: waiting to send | 2 |
| `/r/reports/[code]` | Responder: family report, with the can't assess sheet (tier 2) | 1 |
| `/r/new` | Responder: house with no report | 2 |
| `/r/assess/[entryId]` | Responder: photos and note | 1 |
| `/r/assess/[entryId]/drafting` | Responder: hub drafting | 1 |
| `/r/assess/[entryId]/check` | Responder: check AI draft, and AI can't tell yet | 1 |
| `/r/assess/[entryId]/confirmed` | Responder: entry confirmed | 1 |

The bottom tab bar (To visit, Map, Done, Queue) shows on `/r`, `/r/map`, `/r/done` and `/r/queue`.

### Hub

| Route | Canvas screens | Tier |
|---|---|---|
| `/hub` | Hub: overview, plus the low battery state (tier 3) | 1 |
| `/hub/map` | Hub: map | 1 |
| `/hub/reports` | Hub: situation report and exports | 1 |
| `/hub/review` | Hub: review, second look | 2 |
| `/hub/review/family-reports` | Hub: family reports and assigning | 2 |
| `/hub/review/duplicates` | Hub: possible duplicates | 3 |
| `/hub/map/add` | Hub: add a point to the map | 2 |
| `/hub/entries`, `/hub/entries/[id]` | Hub: all entries, entry and audit trail | 2 |
| `/hub/updates` | Hub: post updates | 2 |
| `/hub/safe-list` | Hub: safe list | 2 |
| `/hub/desk` | Hub: help desk intake | 2 |
| `/hub/reports/[n]/print` | Situation report, printable A4 | 3 |
| `/hub/setup`, `/hub/checklist`, `/hub/ai-check` | Hub: kit setup, before the storm checklist, AI check | 3 |
| `/hub/lock` | Hub: locked | 3 |
| `/hub/poster` | Join poster, printable A4 | 3 |

## 3. Data model

Drizzle with SQLite. IDs are UUID strings unless noted. Timestamps are ISO strings in UTC, shown in Philippine time.

| Table | Columns |
|---|---|
| `settings` | `key` primary, `value`. Keys: `town`, `barangays` (JSON list), `map_bbox` (west, south, east, north), `team_pin_hash`, `staff_pin_hash`, `simulation` (`true` or `false`), `wifi_name`, `hub_address` |
| `responders` | `id`, `name`, `team`, `active` |
| `reports` | `id`, `code` (4 chars, unique), `source` (`family`, `neighbor`, `desk`), `household_head`, `reporter_name`, `reporter_where`, `barangay`, `purok`, `lat`, `lng`, `people`, `hurt`, `missing`, `what_happened`, `needs` (JSON), `voice_path`, `transcript`, `transcript_en`, `language`, `photo_path`, `status` (`waiting`, `assigned`, `on_the_way`, `visited`, `cant_assess`, `merged`), `assigned_to`, `cant_reason`, `cant_note`, `merged_into`, `created_at`, `updated_at` |
| `entries` | `id`, `number` (integer, shown as 0231), `report_id` (nullable), `responder_id`, `barangay`, `purok`, `household_head`, `lat`, `lng`, `gps_accuracy_m`, `families` (default 1, more when families share a house), `people`, `hurt`, `missing`, `needs` (JSON), `material`, `hazards` (JSON), `damage_class` (`none`, `partial`, `total`), `ai_class`, `ai_confidence`, `ai_reason`, `ai_need_more`, `note_path`, `note_transcript`, `note_en`, `status` (`draft`, `needs_review`, `confirmed`), `review_reason`, `confirmed_by`, `confirmed_at`, `created_at` |
| `photos` | `id`, `entry_id` or `report_id`, `path`, `label`, `taken_at` |
| `events` | `id`, `entity` (`report`, `entry`, `update`, `place`, `safe`, `ai`), `entity_id`, `type`, `actor`, `data` (JSON), `at`. This is the audit trail. Model calls log as entity `ai` with a fresh UUID per call, type `ai.voice`, `ai.text` and so on, with `.failed` added on a timeout or a schema failure, and the raw output in `data` |
| `places` | `id`, `type` (`relief`, `shelter`, `hazard`), `name`, `details`, `when_text`, `lat`, `lng`, `visible`, `created_at` |
| `updates` | `id`, `type` (`water_food`, `shelter`, `hazard`, `notice`), `headline`, `message`, `message_ceb`, `message_tl`, `place_id`, `expires_at`, `seen_count`, `posted_at` |
| `safe_checkins` | `id`, `name`, `barangay`, `staying_at`, `message`, `source` (`phone`, `desk`), `at` |
| `duplicates` | `id`, `a_type`, `a_id`, `b_type`, `b_id`, `distance_m`, `status` (`open`, `merged`, `kept`, `mistake`), `resolved_by`, `resolved_at` |
| `sitreps` | `id`, `number`, `created_at`, `snapshot` (JSON of the totals), `sms` |

Rules:

- `entries` with `status = confirmed` are the only rows that feed totals, the map's solid pins and situation reports.
- Report codes use the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, so there is no I, O, 0 or 1.
- An entry linked to a report sets the report's status to `visited` when confirmed.
- Every write also writes an `events` row with the actor.

## 4. API

All bodies are validated with the Zod schemas in `src/lib/contracts/schemas.ts`. Photos and audio are `multipart/form-data`.

| Method and path | Who | Does |
|---|---|---|
| `POST /api/auth/responder` | Responder | Name and PIN, sets session |
| `POST /api/auth/staff` | Staff | PIN, sets session |
| `POST /api/ai/voice` | Family, responder | Audio up to 30 s. Returns `AiVoiceExtract` |
| `POST /api/ai/text` | Family | Typed note. Returns `AiVoiceExtract` with an empty transcript |
| `POST /api/reports` | Family, desk | `NewReport`. Returns the code |
| `GET /api/reports/[code]` | Family | `ReportStatus`, minimal fields only |
| `GET /api/reports` | Responder, staff | List with filters, urgent first |
| `POST /api/reports/[code]/assign` | Staff | Assign to a responder |
| `POST /api/reports/[code]/cant-assess` | Responder | Reason and note |
| `POST /api/entries` | Responder | Creates a draft from photos, note, GPS and an optional report code, then runs the photo pipeline |
| `POST /api/entries` (JSON) | Responder | `StartDraft` with a report code. Starts a draft with no photos from the report's house, or returns the draft already open for it. 409 when the report is visited, cant_assess or merged. Photos are added with `POST /api/entries/[id]/photos` |
| `POST /api/entries/[id]/photos` | Responder | Adds a photo to a draft and runs the photo draft again |
| `GET /api/entries/[id]` | Responder, staff | Entry with photos, AI draft and history |
| `PATCH /api/entries/[id]` | Responder, staff | `EntryConfirm` to confirm, or field edits. Records changes in `events` |
| `GET /api/entries` | Staff | Paginated and filtered list |
| `GET /api/hub/summary` | Staff | Totals, per-barangay rows, priority ranking, needs counts. All SQL |
| `GET /api/hub/status` | Staff | Phones connected, model loaded, battery, storage |
| `POST /api/updates` | Staff | Post an update |
| `POST /api/updates/translate` | Staff | `AiTranslation` drafts |
| `GET /api/updates` | Everyone | Active updates |
| `POST /api/places` | Staff | Add a relief point, shelter or hazard |
| `GET /api/places` | Everyone | Visible places |
| `POST /api/safe` | Family, desk | Check in |
| `GET /api/safe?q=` | Everyone | Name search, returns name, barangay, staying at and time only |
| `POST /api/sitreps` | Staff | Snapshot the totals, build the SMS text |
| `GET /api/export/entries.csv` | Staff | CSV of confirmed entries |
| `GET /api/events` | Everyone | Server-sent events, see below |

### Live events

One `GET /api/events` stream. Each message is a `HubEvent` from the contracts: `report.created`, `report.updated`, `entry.drafted`, `entry.needs_review`, `entry.confirmed`, `update.posted`, `place.saved`, `safe.checked_in`, `hub.status`. Clients refetch what they show when a relevant event arrives. Families only receive events about their own code, updates and places.

## 5. AI pipeline

### Models

- `gemma4:e4b` through Ollama for photos, voice and translation. Keep it loaded with `keep_alive`.
- If Gemma's audio input through Ollama fails the risk check, transcribe with whisper.cpp and send the text to Gemma.
- If photo accuracy on the first ten eval photos is poor, try `gemma4:26b` for photos only. Do not load both models at once.

### Calls

All calls use Ollama's structured output with the JSON schema generated from the Zod schema, then validate again with Zod. Prompts are in `src/lib/ai/prompts.ts`.

1. **Voice note to fields.** Input audio, or a transcript from whisper.cpp. Output `AiVoiceExtract`: language, transcript, English translation, household head, people, hurt, missing, what happened, needs, hazards and a list of fields the model wasn't sure about. Uncertain fields show the "Please check" marker on the check screen.
2. **Photos to damage class.** Input one to three photos, the note transcript if there is one, and the DSWD definitions. Output `AiPhotoDraft`: damage class (`none`, `partial`, `total` or `unclear`), confidence, material, hazards, a reason of one sentence naming what is visible, and `need_more`, such as "Roof from the side", when the class is unclear.
3. **Update translation.** English headline and message to Bisaya and Tagalog drafts. Staff always read them before posting.

### Rules

- One house or one note per call. Never send several houses together.
- Never ask for totals. Code computes them.
- Time out after 60 seconds and fall back to `unclear` with a retry button.
- Store every raw model output in `events` for the audit trail.
- Confidence shows as words: high is "Fairly sure", medium and low are "Not very sure".
- An entry goes to `needs_review` when the responder picks a different class than the AI, when the AI says `unclear` and the responder picks without a new photo, or when the hurt count differs from the linked family report.

## 6. Hub logic

- **Totals** come from confirmed entries: houses checked, totally, partially, none, families, people, hurt, missing. "Not yet visited" is the count of reports with status `waiting`, `assigned` or `on_the_way`.
- **Priority per barangay:** sort by hurt plus missing, then totally damaged, then reports waiting. High when hurt plus missing is 2 or more. Medium when it is 1 or more, or totally damaged is 2 or more. Otherwise low.
- **Needs** count households in confirmed entries that list each need.
- **Duplicates** (tier 3): flag two reports, or a report and an entry, in the same barangay whose household names match after lowercasing and trimming, within 50 m when both have GPS.
- **Phones connected** counts open event streams plus distinct client IPs seen in the last two minutes.
- **Battery** on macOS comes from `pmset -g batt`. Elsewhere it shows "Unknown".

## 7. Situation report and SMS

- `POST /api/sitreps` snapshots the totals and numbers the report.
- The SMS is built by `buildSms` in `src/lib/sms.ts` from the snapshot, never by the model. Count segments with `smsSegments`: 160 characters for one text, 153 per part after that, and 70 and 67 if any character is outside the GSM alphabet.
- The canvas example is 239 characters, which sends as 2 texts.
- CSV columns: entry number, household head, barangay, purok, damage class, people, hurt, missing, needs, material, hazards, responder, confirmed at, linked report code, latitude, longitude.

## 8. Maps

- Extract the town with the `pmtiles` CLI from the Protomaps daily build using a bounding box, before the storm. Put it at `public/map/town.pmtiles`.
- Download the Protomaps basemap glyphs and sprites into `public/map/fonts` and `public/map/sprites`. Without them, labels silently vanish offline.
- Barangay boundaries: the Philippines administrative boundaries on HDX, cut to the town, saved as `public/map/barangays.geojson`. Check the license before committing.
- Layers: barangay shading by totally damaged count (hub only), confirmed entries as colored dots, family reports not yet visited as hollow dots (responders and staff only), relief points, shelters, hazards.
- Families never see household pins.
- Families set their home by GPS or by dragging the map under a center pin.

## 9. Offline behavior on phones

- **Tier 1:** the page keeps the draft in `sessionStorage`. Failed sends show "Try again".
- **Tier 2:** a service worker caches the app shell, and IndexedDB queues reports and entries with their photos and audio. The queue sends when `/api/health` answers. The family "Saved on this phone" screen and the responder Queue tab read this queue.

## 10. Simulation mode

- A setting, on during the drill. Every hub page shows the Simulation pill.
- `pnpm db:seed` loads `seed/simulation.json`, which matches the canvas. Positions in the seed are percentages of the map area, converted to latitude and longitude using the `map_bbox` setting, so the same seed works for any town: 46 checked houses (14 totally, 23 partially, 9 none), 58 families, 241 people, 6 hurt, 1 missing and 17 reports waiting, across 6 barangays.
- "Clear data" on Kit setup wipes reports, entries, photos, updates, places, check-ins and sitreps, and keeps settings and responders.

## 11. Eval

- `eval/photos/` holds 40 to 60 openly licensed damage photos, `eval/labels.csv` has two independent labels per photo, and `eval/SOURCES.md` lists licenses.
- `eval/voice/` holds 10 to 15 notes in Tagalog, Bisaya, Taglish and English, with expected fields in `eval/voice.csv`.
- `pnpm eval` runs the real pipeline and writes `eval/results.json`: the agreement between the two labelers, AI accuracy on agreed photos, a 3 by 3 confusion matrix, seconds per photo and per note, and per-language field accuracy. The AI check page reads this file.
- Never round or edit these numbers by hand.

## 12. Acceptance criteria for the demo loop

1. With the router's internet port empty and phone data off, a phone joins `ULAT-HUB`, opens the hub address, and loads the family home with a valid certificate.
2. A 20 second Bisaya note turns into a filled check screen in under 60 seconds, with the hurt field flagged when the model is unsure.
3. Sending creates a report with a 4 character code, and a hollow pin appears on the hub map within 2 seconds without a refresh.
4. The report appears at the top of the responder's To visit list when someone is hurt or missing.
5. Two photos and a note produce an AI draft with a class and a reason. Confirming it turns the pin solid, updates the hub totals, and changes the family status to the confirmed class.
6. The hub situation report shows the new totals, and the SMS text fits in 2 texts.
7. Everything above works with `MOCK_AI=1` on a machine without Ollama.

## 13. Not doing this weekend

Merging several hubs, satellite imagery, accounts with email, push notifications, native apps, and uploading anything to the cloud during a disaster.
