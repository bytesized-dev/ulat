# Ulat spec

**Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH. Exported screens are in `design/`. `design/README.md` maps every screen to a route, a tier and an issue.

## 1. System

### Hardware and network

- **Hub:** a MacBook running the Next.js app, SQLite, Ollama and Caddy. It runs on battery.
- **Network:** any Wi-Fi router with nothing in its internet port, powered by a power bank. Give the hub a fixed IP with a DHCP reservation. Wi-Fi name `ULAT-HUB`.
- **Phones:** any phone with a browser. Nothing to install.
- **Address:** phones open `https://hub.cjjutba.dev`. The router hands out the hub as the DNS server, dnsmasq on the hub answers that name with the hub's local IP, and Caddy serves a real Let's Encrypt certificate fetched before the storm with a DNS challenge. Phones trust it with no setup, so camera, microphone, GPS and offline caching all work. Details in `infra/README.md`.
- **Fallback:** if the certificate fails, Caddy's internal certificate installed on the demo phones, or plain HTTP with file inputs for photos and typed notes.

### Software

- One Next.js app, three areas: family at `/`, responder at `/r`, hub at `/hub`.
- Route handlers under `/api` are the only backend.
- SQLite file at `data/ulat.db`. Photos and audio at `data/uploads/<yyyy-mm-dd>/<uuid>.<ext>`. Family voice notes are kept apart, at `data/uploads/voice/<yyyy-mm-dd>/<voice_id>.<ext>`, and family report photos at `data/uploads/photo/<yyyy-mm-dd>/<photo_id>.<ext>`.
- Ollama on `localhost:11434` with `gemma4:e4b`.
- Live updates over one server-sent events endpoint.
- `MOCK_AI=1` replaces every AI call with fixtures from `seed/ai-fixtures.json`, so teammates without the model can build everything.

### Roles and access

| Role | How they get in | Can see |
|---|---|---|
| Family | Opens the address | Home, their own report by code, map, updates, safe list search |
| Responder | Email and password on `/r/sign-in`, one account each | All reports and entries, map with households |
| Hub staff | The laptop, staff PIN on `/hub/lock` after idle | Everything |

Responder passwords are hashed in the `responders` table and the staff PIN in the `settings` table. Sessions are signed cookies. The hub sends no email, and an email is only the name a responder signs in with.

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

A recorded note keeps its audio in memory on the phone. The phone makes a `voice_id` (a UUID) when the recording is read, and a typed note clears it. On Agree and send the phone uploads the audio to `POST /api/reports/voice` under that id, then posts the report with the same `voice_id`. The hub sets `reports.voice_path` from it. If the hub answers but refuses the audio, the report goes without it, because the transcript is already in the report. If the hub does not answer, the report is queued with the audio as an attachment.

A family photo works the same way. The phone keeps the picked photo in memory and makes a `photo_id` (a UUID) once per tap on Send, with the `client_id`. It uploads the photo to `POST /api/reports/photo` under that id before the report, then posts the report with the same `photo_id`. The hub sets `reports.photo_path` and adds a `photos` row from it. No AI reads the photo and it never changes a total: it is context a responder sees before the visit. If the hub answers but refuses the photo, the report goes without it. If the hub does not answer, the report is queued with the photo as an attachment.

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
| `settings` | `key` primary, `value`. Keys: `town`, `barangays` (JSON list), `map_bbox` (west, south, east, north), `staff_pin_hash`, `simulation` (`true` or `false`), `wifi_name`, `hub_address` |
| `responders` | `id`, `name`, `team`, `active`, `email` (nullable and unique, stored in lower case), `password_hash` (nullable, scrypt). A responder with no email or no password hash cannot sign in |
| `reports` | `id`, `code` (4 chars, unique), `source` (`family`, `neighbor`, `desk`), `household_head`, `reporter_name`, `reporter_where`, `barangay`, `purok`, `lat`, `lng`, `people`, `hurt`, `missing`, `what_happened`, `needs` (JSON), `voice_path` (the family's recording, relative to the uploads folder, set from `voice_id`), `transcript`, `transcript_en`, `language`, `photo_path` (the family's photo, relative to the uploads folder, set from `photo_id`), `status` (`waiting`, `assigned`, `on_the_way`, `visited`, `cant_assess`, `merged`), `assigned_to`, `cant_reason`, `cant_note`, `merged_into`, `client_id` (nullable and unique, set by a phone so a resend of the same tap finds the report it already made), `created_at`, `updated_at` |
| `entries` | `id`, `number` (integer, shown as 0231), `report_id` (nullable), `responder_id`, `barangay`, `purok`, `household_head`, `lat`, `lng`, `gps_accuracy_m`, `families` (default 1, more when families share a house), `people`, `hurt`, `missing`, `needs` (JSON), `material`, `hazards` (JSON), `damage_class` (`none`, `partial`, `total`), `ai_class`, `ai_confidence`, `ai_reason`, `ai_need_more`, `note_path`, `note_transcript`, `note_en`, `status` (`draft`, `needs_review`, `confirmed`), `review_reason`, `confirmed_by`, `confirmed_at`, `created_at` |
| `photos` | `id`, `entry_id` or `report_id`, `path`, `label`, `taken_at`. A family report photo has the `photo_id` as its `id`, the report as `report_id` and a path under `photo/` |
| `events` | `id`, `entity` (`report`, `entry`, `update`, `place`, `safe`, `ai`), `entity_id`, `type`, `actor`, `data` (JSON), `at`. This is the audit trail. Model calls log as type `ai.voice`, `ai.text`, `ai.photo` or `ai.translate`, with `.failed` added on a timeout or a schema failure, and the raw output in `data`. Voice, text and translate calls use entity `ai` with a fresh UUID per call. The photo draft belongs to an entry, so it logs as entity `entry` with the entry id and shows in that entry's history |
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
| `POST /api/auth/responder` | Responder | Email and password, sets session. A miss is 401 `wrong_email_or_password` |
| `POST /api/auth/staff` | Staff | PIN, sets session |
| `POST /api/ai/voice` | Family, responder | Audio up to 30 s. Returns `AiVoiceExtract` |
| `POST /api/ai/text` | Family | Typed note. Returns `AiVoiceExtract` with an empty transcript |
| `POST /api/reports/voice` | Family | One family recording, no PIN. Multipart with `voice_id` (UUID made on the phone) and `audio`. Same types and size limits as `POST /api/ai/voice`, the length must be declared, and a file under 1 KB (`MIN_VOICE_BYTES`) is refused with 400 `audio_too_small`, since a real note is several KB. Stores it at `data/uploads/voice/<yyyy-mm-dd>/<voice_id>.<ext>` and returns `{ voice_id }` with no URL. Sending the same `voice_id` again stores nothing new. Because it needs no PIN, three caps keep it from filling the disk, and above any of them the route answers 507 `storage_full` before writing. Recordings that no report has taken total at most 200 MB (`MAX_UNLINKED_VOICE_BYTES`) and at most 2000 files (`MAX_UNLINKED_VOICE_FILES`), and the whole voice folder, linked recordings included, holds at most 1 GB (`MAX_VOICE_FOLDER_BYTES`). Every recording counts as whole 4 KiB disk blocks, so a tiny file cannot slip under a byte cap, and the file cap keeps a sweep short. Uploads are stored one at a time, so uploads that arrive together cannot overshoot a cap. The hub keeps running totals in memory, so an upload under both caps does not walk the folder. A sweep walks it at most once a minute, and whenever an upload looks over a cap, so a 507 is judged on exact totals. The sweep deletes recordings no report has taken that are over an hour old and never deletes a linked one. A full hub still takes reports: the phone sends the report without audio when the recording is refused, and the report is saved with `voice_path` null. Nothing serves the audio from this route |
| `POST /api/reports/photo` | Family | One family report photo, no PIN. Multipart with `photo_id` (UUID made on the phone) and `photo`. JPEG, PNG, WebP or HEIC up to 10 MB (`MAX_PHOTO_BYTES`), the length must be declared, and a file under 1 KB (`MIN_PHOTO_BYTES`) is refused with 400 `photo_too_small`. A wrong type is 400 `photo_type_not_allowed` and a file over the limit is 413 `too_large`. Stores it at `data/uploads/photo/<yyyy-mm-dd>/<photo_id>.<ext>` and returns `{ photo_id }` with no URL. Sending the same `photo_id` again stores nothing new. It uses the same store as the voice route, with its own folder, counts, lock and sweep: photos no report has taken total at most 200 MB (`MAX_UNLINKED_PHOTO_BYTES`) and 2000 files (`MAX_UNLINKED_PHOTO_FILES`), the whole photo folder holds at most 4 GB (`MAX_PHOTO_FOLDER_BYTES`), and above any cap the route answers 507 `storage_full` before writing. The sweep deletes photos no report has taken that are over an hour old. A photo is linked when a `photos` row has its path. A full hub still takes reports: the phone sends the report without the photo when it is refused. Nothing serves the photo from this route |
| `POST /api/reports` | Family, desk | `NewReport`. Returns the code. A `voice_id` is linked to the stored file and set as `voice_path`, once per recording. One that was never uploaded or that another report already holds is ignored: the report is saved without audio, the same 201 comes back, and the `report.created` audit row records `voice` as `unknown` or `used`. A `photo_id` works the same way: it sets `photo_path` and adds a `photos` row with that id, once per photo, a missing or used one is ignored with the same 201, and the audit row records `photo` as `unknown`, `used` or `attached` |
| `GET /api/reports/[code]` | Family | `ReportStatus`, minimal fields only |
| `GET /api/reports` | Responder, staff | List with filters, urgent first |
| `GET /api/files/[id]` | Responder, staff | A photo by photo id, which includes a family report photo, an entry's voice note by entry id, or a family's voice note by report id. Range requests work. Without a PIN it answers 401 |
| `POST /api/reports/[code]/assign` | Staff | Assign to a responder |
| `POST /api/reports/[code]/cant-assess` | Responder | Reason and note |
| `POST /api/entries` | Responder | Creates a draft from photos, note, GPS and an optional report code, then runs the photo pipeline |
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

- `gemma4:e4b` through Ollama for photos, voice and translation. Keep it loaded with `keep_alive`. Every call sends `think: false` and caps its output with `num_predict`.
- Ollama reads audio only as WAV. It answers a webm, ogg or mp4 recording with 400 "media expansion produced no tokens". So the hub converts every voice note to 16 kHz mono WAV with ffmpeg before the call (`src/lib/ai/audio.ts`).
- If Gemma's audio input through Ollama fails the risk check, transcribe with whisper.cpp and send the text to Gemma.
- If photo accuracy on the first ten eval photos is poor, try `gemma4:26b` for photos only. Do not load both models at once.

### Calls

All calls first use Ollama's structured output (`format`) with the JSON schema generated from the Zod schema, then validate again with Zod. Some Ollama builds, such as Homebrew 0.40.2 on the MLX runner, lack `libollama_xgrammar` and answer any request with `format` with a 501 "structured output is unavailable". On that answer the call is sent once more without `format`, with the schema and "reply with one JSON object only, no code fence" added to the user message. The hub remembers this until the app restarts, so later calls skip the first try. A code fence around the reply is trimmed before parsing. The Zod check and the unclear and `invalid_output` rules are the same in both modes. Prompts are in `src/lib/ai/prompts.ts`.

1. **Voice note to fields.** Input audio, or a transcript from whisper.cpp. Output `AiVoiceExtract`: language, transcript, English translation, household head, people, hurt, missing, what happened, needs, hazards and a list of fields the model wasn't sure about. Uncertain fields show the "Please check" marker on the check screen.
2. **Photos to damage class.** Input one to three photos, the note transcript if there is one, and the DSWD definitions. Output `AiPhotoDraft`: damage class (`none`, `partial`, `total` or `unclear`), confidence, material, hazards, a reason of one sentence naming what is visible, and `need_more`, such as "Roof from the side", when the class is unclear.
3. **Update translation.** English headline and message to Bisaya and Tagalog drafts. Staff always read them before posting.

### Rules

- One house or one note per call. Never send several houses together.
- Never ask for totals. Code computes them.
- Time out after 60 seconds. A photo falls back to `unclear` with a retry button. Voice, text and translate return 504 `timeout` with `retry: true`.
- Validate every model output with the Zod schemas. Only `AiPhotoDraft` has an `unclear` value, so an invalid photo draft becomes `unclear`. Voice, text and translate return 502 `invalid_output` with `retry: true`, and the person retries or types the fields.
- Store every raw model output in `events` for the audit trail, including output that failed validation.
- Confidence shows as words: high is "Fairly sure", medium and low are "Not very sure".
- An entry goes to `needs_review` when the responder picks a different class than the AI, when the AI says `unclear` and the responder picks without a new photo, or when the hurt count differs from the linked family report.

## 6. Hub logic

- **Totals** come from confirmed entries: houses checked, totally, partially, none, families, people, hurt, missing. "Not yet visited" is the count of reports with status `waiting`, `assigned` or `on_the_way`.
- **Priority per barangay:** sort by hurt plus missing, then totally damaged, then reports waiting. High when hurt plus missing is 2 or more. Medium when it is 1 or more, or totally damaged is 2 or more. Otherwise low.
- **Needs** count households in confirmed entries that list each need.
- **Duplicates** (tier 3): flag two reports, or a report and an entry, in the same barangay whose household names match after lowercasing and trimming, within 50 m when both have GPS.
- **Phones connected** counts distinct client IPs seen in the last two minutes. The IP is the first entry of the `X-Forwarded-For` header, which Caddy sets, and loopback addresses are skipped. An open event stream refreshes its IP on every ping, so it is not counted separately. Without Caddy in front, as under plain `pnpm dev`, there is no header and the count reads 0.
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
- **Tier 2:** a service worker caches the app shell, and IndexedDB queues reports and entries with their photos and audio. The queue sends when `/api/health` answers. A family report with a recording uploads the audio first, then posts the report with its `voice_id`, and the queue keeps its copy of the audio until the hub accepts the report, so a retry or a fixed report sends it again, and the same `voice_id` never makes a second file. A family report with a photo does the same with the photo and its `photo_id`: the queue keeps the photo as an attachment, uploads it before the report, and keeps its copy until the hub accepts the report. A report queued before photos existed has no `photo_id` and still sends. The family "Saved on this phone" screen and the responder Queue tab read this queue.

## 10. Simulation mode

- A setting, on during the drill. Every hub page shows the Simulation pill.
- `pnpm db:seed` loads `seed/simulation.json`, which matches the canvas. Positions in the seed are percentages of the map area, converted to latitude and longitude using the `map_bbox` setting, so the same seed works for any town: 46 checked houses (14 totally, 23 partially, 9 none), 58 families, 241 people, 6 hurt, 1 missing and 17 reports waiting, across 6 barangays.
- "Clear data" on Kit setup wipes reports, entries, photos, updates, places, check-ins, sitreps, the `events` audit trail and the `duplicates` flags, and empties the uploads folder of photos and audio, family voice notes and family report photos included. It keeps settings and responders. The rows go in one transaction. The files go after it commits.

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
