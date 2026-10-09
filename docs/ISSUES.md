# Ulat issues

**Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH

Paste each issue into Linear as is. Priority means tier: Urgent is tier 1, High is tier 2, Medium is tier 3. Linear will give its own IDs. Keep these IDs in the title so cross references still work.

## Summary

| ID | Title | Owner | Label | Priority | Hours |
|---|---|---|---|---|---|
| BYT-01 | Repo from the starter kit with SQLite | CJ | platform | Urgent | 1 |
| BYT-02 | Design tokens and fonts | CJ | platform | Urgent | 0.5 |
| BYT-03 | UI kit components | CJ | platform | Urgent | 1.5 |
| BYT-04 | Database schema, contracts, seed and mock AI | CJ | platform | Urgent | 1 |
| BYT-05 | Risk check: HTTPS on the local network | Teammate A | infra | Urgent | 1.5 |
| BYT-06 | Risk check: eval photos and voice notes | Teammate B | ai | Urgent | 1.5 |
| BYT-07 | Risk check: offline map package and MapView | Teammate C | hub | Urgent | 1.5 |
| BYT-08 | Risk check: Ollama and Gemma 4 E4B | CJ | ai | Urgent | 0.5 |
| BYT-10 | Family home | Teammate A | family | Urgent | 1 |
| BYT-11 | Report start: whose household | Teammate A | family | Urgent | 1 |
| BYT-12 | Voice note: ready, recording, reading, retry, microphone off | Teammate A | family | Urgent | 2.5 |
| BYT-13 | Check your report | Teammate A | family | Urgent | 2 |
| BYT-14 | Set home location | Teammate A | family | Urgent | 1 |
| BYT-15 | Before you send and report sent | Teammate A | family | Urgent | 1.5 |
| BYT-16 | Status by code | Teammate A | family | Urgent | 1 |
| BYT-20 | Responder sign in | Teammate B | responder | Urgent | 1 |
| BYT-21 | To visit list | Teammate B | responder | Urgent | 1.5 |
| BYT-22 | Family report detail | Teammate B | responder | Urgent | 1 |
| BYT-23 | Capture photos and note | Teammate B | responder | Urgent | 2 |
| BYT-24 | Drafting, check the draft, unclear and confirmed | Teammate B | responder | Urgent | 2.5 |
| BYT-30 | Hub shell | Teammate C | hub | Urgent | 1 |
| BYT-31 | Hub overview | Teammate C | hub | Urgent | 2 |
| BYT-32 | Hub map | Teammate C | hub | Urgent | 1 |
| BYT-33 | Situation report, SMS and CSV | Teammate C | hub | Urgent | 1.5 |
| BYT-40 | Reports API | CJ | platform | Urgent | 1.5 |
| BYT-41 | Entries API and audit trail | CJ | platform | Urgent | 2 |
| BYT-42 | AI: voice and text to fields | CJ | ai | Urgent | 2 |
| BYT-43 | AI: photos to damage class | CJ | ai | Urgent | 2 |
| BYT-44 | Live events | CJ | platform | Urgent | 1 |
| BYT-45 | Summary queries | Teammate C | hub | Urgent | 1 |
| BYT-46 | Eval script | CJ | ai | High | 1.5 |
| BYT-50 | Type instead | Teammate A | family | High | 1 |
| BYT-51 | Report for a neighbor | Teammate A | family | High | 1 |
| BYT-52 | Edit sheet and what we heard sheet | Teammate A | family | High | 1 |
| BYT-53 | Map, updates and safe list | Teammate A | family | High | 2 |
| BYT-54 | Offline queue and saved on phone | Teammate A | family | High | 2 |
| BYT-55 | Responder map, done and queue tabs | Teammate B | responder | High | 2 |
| BYT-56 | House with no report and can't assess | Teammate B | responder | High | 1.5 |
| BYT-57 | Review, second look | Teammate C | hub | High | 1.5 |
| BYT-58 | Family reports and assigning | Teammate C | hub | High | 1.5 |
| BYT-59 | All entries and entry detail | Teammate C | hub | High | 2 |
| BYT-60 | Updates, translations and map points | Teammate C | hub | High | 2 |
| BYT-61 | Safe list and help desk | Teammate C | hub | High | 2 |
| BYT-70 | Possible duplicates | Teammate C | hub | Medium | 1.5 |
| BYT-71 | Printable situation report and join poster | Teammate C | hub | Medium | 1 |
| BYT-72 | Kit setup, checklist and AI check pages | Teammate B | hub | Medium | 2 |
| BYT-73 | Lock screen and low battery | Teammate B | hub | Medium | 1 |
| BYT-74 | Simulation mode and clear data | CJ | platform | High | 0.5 |
| BYT-80 | README and disclosures | Teammate C | demo | Urgent | 1 |
| BYT-81 | Demo seed and dry run | CJ | demo | Urgent | 1 |
| BYT-82 | Record and post the video | Teammate B | demo | Urgent | 1.5 |
| BYT-83 | Pitch and Q&A rehearsal | Teammate A | demo | Urgent | 1 |
| BYT-84 | Submit on Cerebral Valley | CJ | demo | Urgent | 0.5 |

Hours per person: CJ 16.5, Teammate A 19.5, Teammate B 17.5, Teammate C 20.5.

---

## BYT-01 Repo from the starter kit with SQLite

- **Owner:** CJ
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Spec:** 1, 3

**Acceptance criteria**

- [ ] `bytesized-dev/ulat` is public and builds
- [ ] Neon and Better Auth are removed, Drizzle uses better-sqlite3 with `data/ulat.db`
- [ ] `pnpm db:push` creates the schema, `pnpm dev` runs on port 3000
- [ ] AGENTS.md, CLAUDE.md, DESIGN.md, docs and design from this scaffold are committed
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-02 Design tokens and fonts

- **Owner:** CJ
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 0.5 h
- **Depends on:** BYT-01
- **Spec:** DESIGN.md

**Acceptance criteria**

- [ ] `design/tokens.css` is in `globals.css` and Tailwind utilities use the token names
- [ ] Inter and JetBrains Mono load through `next/font` with no request to Google at runtime
- [ ] The starter kit rule tests still pass: no hex in components, no arbitrary values, no dashes in copy
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-03 UI kit components

- **Owner:** CJ
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-02
- **Spec:** DESIGN.md components
- **Screens:**
  - Family: check your report: `design/screens/family/check-your-report.html`, `design/png/family/check-your-report.png`, route `/report/check`
  - Responder: to visit: `design/screens/responder/to-visit.html`, `design/png/responder/to-visit.png`, route `/r`
  - Hub: overview: `design/screens/hub/overview.html`, `design/png/hub/overview.png`, route `/hub`

**Acceptance criteria**

- [ ] Every component in the DESIGN.md table exists in `src/components/ui` with typed props
- [ ] `/dev/kit` renders all of them with their variants
- [ ] Buttons and chips meet 44px targets and icon buttons have aria-labels
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-04 Database schema, contracts, seed and mock AI

- **Owner:** CJ
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-01
- **Spec:** 3, 10

**Acceptance criteria**

- [ ] Drizzle schema matches SPEC section 3
- [ ] `src/lib/contracts` from the scaffold is in place and exported
- [ ] `pnpm db:seed` loads `seed/simulation.json` and the hub totals match the canvas: 46 houses, 14 totally, 23 partially, 9 none, 58 families, 241 people, 6 hurt, 1 missing, 17 waiting
- [ ] `MOCK_AI=1` makes every AI call return fixtures
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-05 Risk check: HTTPS on the local network

- **Owner:** Teammate A
- **Label:** infra
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Spec:** 1 and infra/README.md

**Acceptance criteria**

- [ ] Router with no internet, hub on a fixed IP, dnsmasq answering the hub name
- [ ] Certificate trusted by one Android phone and one iPhone with no setup on the phone
- [ ] Camera, microphone and GPS work in the browser on both phones with mobile data off
- [ ] Fallback documented if any step fails
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-06 Risk check: eval photos and voice notes

- **Owner:** Teammate B
- **Label:** ai
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Spec:** 11

**Acceptance criteria**

- [ ] 40 to 60 openly licensed damage photos in `eval/photos` with sources in `eval/SOURCES.md`
- [ ] Two people label each photo separately in `eval/labels.csv` using the DSWD definitions
- [ ] 10 to 15 voice notes in Tagalog, Bisaya, Taglish and English in `eval/voice` with expected fields in `eval/voice.csv`
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-07 Risk check: offline map package and MapView

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Spec:** 8
- **Screens:**
  - Hub: map: `design/screens/hub/map.html`, `design/png/hub/map.png`, route `/hub/map`
  - Family: map: `design/screens/family/map.html`, `design/png/family/map.png`, route `/map`

**Acceptance criteria**

- [ ] `public/map/town.pmtiles`, glyphs, sprites and `barangays.geojson` are in place
- [ ] `MapView` renders with the network off, labels visible
- [ ] Pin types, legend, zoom buttons and barangay shading work as props
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-08 Risk check: Ollama and Gemma 4 E4B

- **Owner:** CJ
- **Label:** ai
- **Priority:** Urgent, tier 1
- **Estimate:** 0.5 h
- **Spec:** 5

**Acceptance criteria**

- [ ] `gemma4:e4b` runs on the hub
- [ ] Photo prompt returns a valid `AiPhotoDraft` on 10 eval photos, accuracy noted
- [ ] Audio input tested with one Bisaya and one Tagalog note, decision recorded: native audio or whisper.cpp
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-10 Family home

- **Owner:** Teammate A
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-03
- **Spec:** 2
- **Screens:**
  - Family: home: `design/screens/family/home.html`, `design/png/family/home.png`, route `/`

**Acceptance criteria**

- [ ] Matches the PNG at 390px
- [ ] Latest update comes from `GET /api/updates`
- [ ] Every row links to its route
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-11 Report start: whose household

- **Owner:** Teammate A
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-03
- **Spec:** 2
- **Screens:**
  - Family: whose household: `design/screens/family/whose-household.html`, `design/png/family/whose-household.png`, route `/report`

**Acceptance criteria**

- [ ] Barangay list comes from settings
- [ ] Choice and fields are kept in the report draft in sessionStorage
- [ ] Progress shows step 1 of 4
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-12 Voice note: ready, recording, reading, retry, microphone off

- **Owner:** Teammate A
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 2.5 h
- **Depends on:** BYT-11
- **Spec:** 2, 5
- **Screens:**
  - Family: voice note, ready: `design/screens/family/voice-note-ready.html`, `design/png/family/voice-note-ready.png`, route `/report/voice`
  - Family: voice note, recording: `design/screens/family/voice-note-recording.html`, `design/png/family/voice-note-recording.png`, route `/report/voice, state`
  - Family: reading the note: `design/screens/family/reading-the-note.html`, `design/png/family/reading-the-note.png`, route `/report/voice, state`
  - Family: note not understood: `design/screens/family/note-not-understood.html`, `design/png/family/note-not-understood.png`, route `/report/voice, state`
  - Family: microphone blocked: `design/screens/family/microphone-blocked.html`, `design/png/family/microphone-blocked.png`, route `/report/voice, state`

**Acceptance criteria**

- [ ] MediaRecorder records up to 30 seconds with a live timer and waveform
- [ ] Stop sends the audio to `POST /api/ai/voice` and shows the reading state with the transcript
- [ ] A failed or empty transcript shows the retry state
- [ ] A denied microphone permission shows the microphone off state
- [ ] Respects reduced motion
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-13 Check your report

- **Owner:** Teammate A
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-12
- **Spec:** 2, 5
- **Screens:**
  - Family: check your report: `design/screens/family/check-your-report.html`, `design/png/family/check-your-report.png`, route `/report/check`

**Acceptance criteria**

- [ ] Fields are filled from `AiVoiceExtract`
- [ ] Uncertain fields show the Please check marker
- [ ] Counters, needs chips and the voice note row work
- [ ] Continue goes to the send screen
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-14 Set home location

- **Owner:** Teammate A
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-07
- **Spec:** 8
- **Screens:**
  - Family: set home location: `design/screens/family/set-home-location.html`, `design/png/family/set-home-location.png`, route `/report/location`

**Acceptance criteria**

- [ ] Uses GPS when allowed, otherwise the center pin on MapView
- [ ] Shows the barangay and purok under the pin
- [ ] Use this spot saves the location to the draft
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-15 Before you send and report sent

- **Owner:** Teammate A
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-40
- **Spec:** 2, 3
- **Screens:**
  - Family: before you send: `design/screens/family/before-you-send.html`, `design/png/family/before-you-send.png`, route `/report/send`
  - Family: report sent: `design/screens/family/report-sent.html`, `design/png/family/report-sent.png`, route `/report/sent`

**Acceptance criteria**

- [ ] Agree and send posts `NewReport` with consent true
- [ ] Report sent shows the 4 character code in mono and Copy code works
- [ ] The timeline shows Sent with the time
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-16 Status by code

- **Owner:** Teammate A
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-40
- **Spec:** 2, 4
- **Screens:**
  - Family: status, waiting for visit: `design/screens/family/status-waiting-for-visit.html`, `design/png/family/status-waiting-for-visit.png`, route `/status`
  - Family: status, visited: `design/screens/family/status-visited.html`, `design/png/family/status-visited.png`, route `/status, state`

**Acceptance criteria**

- [ ] Code lookup uses `GET /api/reports/[code]`
- [ ] Waiting and visited states match the PNGs
- [ ] Updates live when the report changes
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-20 Responder sign in

- **Owner:** Teammate B
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-03
- **Spec:** 1 roles
- **Screens:**
  - Responder: unlock: `design/screens/responder/unlock.html`, `design/png/responder/unlock.png`, route `/r/sign-in`

**Acceptance criteria**

- [ ] Name list from `responders`, 6 digit PIN pad
- [ ] `POST /api/auth/responder` sets the session
- [ ] All `/r` routes redirect here without a session
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-21 To visit list

- **Owner:** Teammate B
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-20
- **Spec:** 2, 6
- **Screens:**
  - Responder: to visit: `design/screens/responder/to-visit.html`, `design/png/responder/to-visit.png`, route `/r`

**Acceptance criteria**

- [ ] Urgent first: hurt or missing on top, then distance
- [ ] Updates live on `report.created` and `report.updated`
- [ ] Tab bar with four tabs
- [ ] New house button links to `/r/new`
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-22 Family report detail

- **Owner:** Teammate B
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-21
- **Spec:** 2
- **Screens:**
  - Responder: family report: `design/screens/responder/family-report.html`, `design/png/responder/family-report.png`, route `/r/reports/[code]`

**Acceptance criteria**

- [ ] Shows counts, needs, voice note with transcript and English
- [ ] Start assessment creates a draft entry and opens capture
- [ ] Can't assess opens the sheet from BYT-56, or links to it if not built yet
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-23 Capture photos and note

- **Owner:** Teammate B
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-22
- **Spec:** 2, 4
- **Screens:**
  - Responder: photos and note: `design/screens/responder/photos-and-note.html`, `design/png/responder/photos-and-note.png`, route `/r/assess/[entryId]`

**Acceptance criteria**

- [ ] Up to 3 photos through the camera, with labels
- [ ] Voice note up to 30 seconds with playback
- [ ] GPS saved with accuracy
- [ ] Send posts to `POST /api/entries` and opens drafting
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-24 Drafting, check the draft, unclear and confirmed

- **Owner:** Teammate B
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 2.5 h
- **Depends on:** BYT-23
- **Spec:** 5
- **Screens:**
  - Responder: hub drafting: `design/screens/responder/hub-drafting.html`, `design/png/responder/hub-drafting.png`, route `/r/assess/[entryId]/drafting`
  - Responder: check AI draft: `design/screens/responder/check-ai-draft.html`, `design/png/responder/check-ai-draft.png`, route `/r/assess/[entryId]/check`
  - Responder: AI can't tell: `design/screens/responder/ai-cant-tell.html`, `design/png/responder/ai-cant-tell.png`, route `/r/assess/[entryId]/check, state`
  - Responder: entry confirmed: `design/screens/responder/entry-confirmed.html`, `design/png/responder/entry-confirmed.png`, route `/r/assess/[entryId]/confirmed`

**Acceptance criteria**

- [ ] Drafting updates live until `entry.drafted`
- [ ] The dark suggestion card shows class, confidence and reason
- [ ] Unclear shows the needed photo and blocks confirm until a class is chosen
- [ ] Confirm sends `EntryConfirm`, then shows confirmed with the next urgent report
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-30 Hub shell

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-03
- **Spec:** 2, 6
- **Screens:**
  - Hub: overview: `design/screens/hub/overview.html`, `design/png/hub/overview.png`, route `/hub`

**Acceptance criteria**

- [ ] Sidebar with every section and the Review count
- [ ] Status block shows offline, phones and battery from `GET /api/hub/status`
- [ ] Top bar with title, Simulation pill and search
- [ ] Right rail slot
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-31 Hub overview

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-30, BYT-45
- **Spec:** 6
- **Screens:**
  - Hub: overview: `design/screens/hub/overview.html`, `design/png/hub/overview.png`, route `/hub`

**Acceptance criteria**

- [ ] Dark hero with totals from `GET /api/hub/summary`
- [ ] Map with all layers, table by barangay, go first, needs and latest
- [ ] Updates live on entry and report events
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-32 Hub map

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-07, BYT-30
- **Spec:** 8
- **Screens:**
  - Hub: map: `design/screens/hub/map.html`, `design/png/hub/map.png`, route `/hub/map`

**Acceptance criteria**

- [ ] Layer toggles and counts
- [ ] Selecting a pin shows it in the rail with Open entry
- [ ] Add point links to `/hub/map/add`
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-33 Situation report, SMS and CSV

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-45
- **Spec:** 7
- **Screens:**
  - Hub: situation report and exports: `design/screens/hub/situation-report-and-exports.html`, `design/png/hub/situation-report-and-exports.png`, route `/hub/reports`

**Acceptance criteria**

- [ ] Create report snapshots totals with `POST /api/sitreps`
- [ ] SMS text comes from `buildSms` with a character and text count
- [ ] CSV downloads from `GET /api/export/entries.csv`
- [ ] Shows how many entries are still in review
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-40 Reports API

- **Owner:** CJ
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-04
- **Spec:** 3, 4

**Acceptance criteria**

- [ ] `POST /api/reports`, `GET /api/reports/[code]`, `GET /api/reports` validated with Zod
- [ ] Codes use the safe alphabet and are unique
- [ ] Events written for every change
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-41 Entries API and audit trail

- **Owner:** CJ
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-04
- **Spec:** 3, 4, 5

**Acceptance criteria**

- [ ] `POST /api/entries` stores photos and audio and creates a draft
- [ ] `PATCH /api/entries/[id]` confirms, records every changed field in events, and sets needs_review per SPEC section 5
- [ ] Confirming a linked entry sets the report to visited
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-42 AI: voice and text to fields

- **Owner:** CJ
- **Label:** ai
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-08
- **Spec:** 5

**Acceptance criteria**

- [ ] `POST /api/ai/voice` and `/api/ai/text` return a valid `AiVoiceExtract`
- [ ] English translation included
- [ ] 60 second timeout and fixtures under `MOCK_AI=1`
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-43 AI: photos to damage class

- **Owner:** CJ
- **Label:** ai
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-08, BYT-41
- **Spec:** 5

**Acceptance criteria**

- [ ] Runs after an entry is created and emits `entry.drafted`
- [ ] Uses the DSWD definitions prompt and returns `AiPhotoDraft`
- [ ] Invalid output falls back to unclear with the raw output logged
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-44 Live events

- **Owner:** CJ
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-04
- **Spec:** 4

**Acceptance criteria**

- [ ] `GET /api/events` streams `HubEvent` messages
- [ ] Family clients only get events for their code, updates and places
- [ ] A small client hook reconnects on drop
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-45 Summary queries

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-04
- **Spec:** 6

**Acceptance criteria**

- [ ] Totals, per barangay rows, priority and needs come from SQL
- [ ] Seed data reproduces the canvas numbers exactly
- [ ] Unit tests cover the priority rule
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-46 Eval script

- **Owner:** CJ
- **Label:** ai
- **Priority:** High, tier 2
- **Estimate:** 1.5 h
- **Depends on:** BYT-06, BYT-43
- **Spec:** 11
- **Screens:**
  - Hub: AI check: `design/screens/hub/ai-check.html`, `design/png/hub/ai-check.png`, route `/hub/ai-check`

**Acceptance criteria**

- [ ] `pnpm eval` writes `eval/results.json` with agreement, accuracy, confusion matrix, timings and per language accuracy
- [ ] Numbers are never edited by hand
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-50 Type instead

- **Owner:** Teammate A
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 1 h
- **Depends on:** BYT-42
- **Spec:** 2, 5
- **Screens:**
  - Family: type instead: `design/screens/family/type-instead.html`, `design/png/family/type-instead.png`, route `/report/type`

**Acceptance criteria**

- [ ] Text goes to `POST /api/ai/text` and fills the check screen
- [ ] Character count shown, Record instead goes back
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-51 Report for a neighbor

- **Owner:** Teammate A
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 1 h
- **Depends on:** BYT-11
- **Spec:** 2
- **Screens:**
  - Family: report for a neighbor: `design/screens/family/report-for-a-neighbor.html`, `design/png/family/report-for-a-neighbor.png`, route `/report?for=neighbor`

**Acceptance criteria**

- [ ] `?for=neighbor` shows their house and you sections
- [ ] Report source is neighbor with reporter name and where to find them
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-52 Edit sheet and what we heard sheet

- **Owner:** Teammate A
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 1 h
- **Depends on:** BYT-13
- **Spec:** 2
- **Screens:**
  - Family: edit a field: `design/screens/family/edit-a-field.html`, `design/png/family/edit-a-field.png`, route `/report/check, sheet`
  - Family: what we heard: `design/screens/family/what-we-heard.html`, `design/png/family/what-we-heard.png`, route `/report/check, sheet`

**Acceptance criteria**

- [ ] Tapping a row opens the edit sheet for that field
- [ ] The voice note row opens the transcript sheet with playback and English
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-53 Map, updates and safe list

- **Owner:** Teammate A
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-07
- **Spec:** 2, 4, 8
- **Screens:**
  - Family: map: `design/screens/family/map.html`, `design/png/family/map.png`, route `/map`
  - Family: updates from MDRRMO: `design/screens/family/updates-from-mdrrmo.html`, `design/png/family/updates-from-mdrrmo.png`, route `/updates`
  - Family: I'm safe: `design/screens/family/im-safe.html`, `design/png/family/im-safe.png`, route `/safe`
  - Family: on the safe list: `design/screens/family/on-the-safe-list.html`, `design/png/family/on-the-safe-list.png`, route `/safe/done`

**Acceptance criteria**

- [ ] Map shows only relief, shelters and hazards with filter chips
- [ ] Updates list from the API
- [ ] Safe check in and name search work, confirmation screen shown
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-54 Offline queue and saved on phone

- **Owner:** Teammate A
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-15
- **Spec:** 9
- **Screens:**
  - Family: saved on phone: `design/screens/family/saved-on-phone.html`, `design/png/family/saved-on-phone.png`, route `any, state`

**Acceptance criteria**

- [ ] Service worker caches the shell
- [ ] IndexedDB queues reports with audio and photos
- [ ] Saved on phone screen shows the queue and sends when the hub answers
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-55 Responder map, done and queue tabs

- **Owner:** Teammate B
- **Label:** responder
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-21, BYT-07
- **Spec:** 2, 9
- **Screens:**
  - Responder: map: `design/screens/responder/map.html`, `design/png/responder/map.png`, route `/r/map`
  - Responder: done: `design/screens/responder/done.html`, `design/png/responder/done.png`, route `/r/done`
  - Responder: waiting to send: `design/screens/responder/waiting-to-send.html`, `design/png/responder/waiting-to-send.png`, route `/r/queue`

**Acceptance criteria**

- [ ] Map with you, reports and confirmed pins and a bottom sheet
- [ ] Done shows drafts needing a check and today's confirmed entries
- [ ] Queue lists entries saved offline and sends them when back in range
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-56 House with no report and can't assess

- **Owner:** Teammate B
- **Label:** responder
- **Priority:** High, tier 2
- **Estimate:** 1.5 h
- **Depends on:** BYT-23
- **Spec:** 2, 3
- **Screens:**
  - Responder: house with no report: `design/screens/responder/house-with-no-report.html`, `design/png/responder/house-with-no-report.png`, route `/r/new`
  - Responder: can't assess a house: `design/screens/responder/cant-assess-a-house.html`, `design/png/responder/cant-assess-a-house.png`, route `/r/reports/[code], sheet`

**Acceptance criteria**

- [ ] New house creates an entry with no report
- [ ] Can't assess sheet posts the reason and note and keeps the report on the list
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-57 Review, second look

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 1.5 h
- **Depends on:** BYT-41
- **Spec:** 5
- **Screens:**
  - Hub: review: `design/screens/hub/review.html`, `design/png/hub/review.png`, route `/hub/review`

**Acceptance criteria**

- [ ] Lists needs_review entries with the reason
- [ ] Shows AI draft and responder choice side by side
- [ ] Approve, use the AI class, or ask for photos, each written to events
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-58 Family reports and assigning

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 1.5 h
- **Depends on:** BYT-40
- **Spec:** 4
- **Screens:**
  - Hub: family reports and assigning: `design/screens/hub/family-reports-and-assigning.html`, `design/png/hub/family-reports-and-assigning.png`, route `/hub/review/family-reports`

**Acceptance criteria**

- [ ] Table with filters and counts
- [ ] Selected report shows the voice note and an Assign to list
- [ ] Assigning emits `report.updated` and shows on the responder list
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-59 All entries and entry detail

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-41
- **Spec:** 3, 4
- **Screens:**
  - Hub: all entries: `design/screens/hub/all-entries.html`, `design/png/hub/all-entries.png`, route `/hub/entries`
  - Hub: entry and audit trail: `design/screens/hub/entry-and-audit-trail.html`, `design/png/hub/entry-and-audit-trail.png`, route `/hub/entries/[id]`

**Acceptance criteria**

- [ ] Paginated, filterable list
- [ ] Detail shows photos, note, AI draft compared with the final entry, location and history from events
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-60 Updates, translations and map points

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-42
- **Spec:** 4, 5
- **Screens:**
  - Hub: post updates: `design/screens/hub/post-updates.html`, `design/png/hub/post-updates.png`, route `/hub/updates`
  - Hub: add a point to the map: `design/screens/hub/add-a-point-to-the-map.html`, `design/png/hub/add-a-point-to-the-map.png`, route `/hub/map/add`

**Acceptance criteria**

- [ ] Draft Bisaya and Tagalog with `POST /api/updates/translate`
- [ ] Post shows on family phones live
- [ ] Add a point places a relief point, shelter or hazard on the map
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-61 Safe list and help desk

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-40
- **Spec:** 2, 4
- **Screens:**
  - Hub: safe list: `design/screens/hub/safe-list.html`, `design/png/hub/safe-list.png`, route `/hub/safe-list`
  - Hub: help desk intake: `design/screens/hub/help-desk-intake.html`, `design/png/hub/help-desk-intake.png`, route `/hub/desk`

**Acceptance criteria**

- [ ] Safe list search and counts
- [ ] Help desk creates a report with source desk, can record a voice note on the laptop, and shows a code slip
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-70 Possible duplicates

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** Medium, tier 3
- **Estimate:** 1.5 h
- **Depends on:** BYT-40, BYT-41
- **Spec:** 6
- **Screens:**
  - Hub: possible duplicates: `design/screens/hub/possible-duplicates.html`, `design/png/hub/possible-duplicates.png`, route `/hub/review/duplicates`

**Acceptance criteria**

- [ ] Detection per SPEC section 6
- [ ] Merge keeps both notes and the higher hurt count, the family keeps the first code
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-71 Printable situation report and join poster

- **Owner:** Teammate C
- **Label:** hub
- **Priority:** Medium, tier 3
- **Estimate:** 1 h
- **Depends on:** BYT-33
- **Spec:** 7
- **Screens:**
  - Situation report, printable A4: `design/screens/print/situation-report.html`, `design/png/print/situation-report.png`, route `/hub/reports/[n]/print`
  - Join poster for the evacuation center: `design/screens/print/join-poster.html`, `design/png/print/join-poster.png`, route `/hub/poster`

**Acceptance criteria**

- [ ] Both print on one A4 page
- [ ] QR code points to the hub address from settings
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-72 Kit setup, checklist and AI check pages

- **Owner:** Teammate B
- **Label:** hub
- **Priority:** Medium, tier 3
- **Estimate:** 2 h
- **Depends on:** BYT-46
- **Spec:** 1, 11
- **Screens:**
  - Hub: kit setup: `design/screens/hub/kit-setup.html`, `design/png/hub/kit-setup.png`, route `/hub/setup`
  - Hub: before the storm checklist: `design/screens/hub/before-the-storm-checklist.html`, `design/png/hub/before-the-storm-checklist.png`, route `/hub/checklist`
  - Hub: AI check: `design/screens/hub/ai-check.html`, `design/png/hub/ai-check.png`, route `/hub/ai-check`

**Acceptance criteria**

- [ ] Setup reads real status from `GET /api/hub/status`
- [ ] Checklist items are stored in settings
- [ ] AI check reads `eval/results.json`
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-73 Lock screen and low battery

- **Owner:** Teammate B
- **Label:** hub
- **Priority:** Medium, tier 3
- **Estimate:** 1 h
- **Depends on:** BYT-30
- **Spec:** 1, 6
- **Screens:**
  - Hub: locked: `design/screens/hub/locked.html`, `design/png/hub/locked.png`, route `/hub/lock`
  - Hub: low battery warning: `design/screens/hub/low-battery-warning.html`, `design/png/hub/low-battery-warning.png`, route `/hub, state`

**Acceptance criteria**

- [ ] Staff PIN unlocks, lock after 10 minutes idle
- [ ] Low battery banner under 20%
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-74 Simulation mode and clear data

- **Owner:** CJ
- **Label:** platform
- **Priority:** High, tier 2
- **Estimate:** 0.5 h
- **Depends on:** BYT-04
- **Spec:** 10

**Acceptance criteria**

- [ ] Simulation pill from settings
- [ ] Clear data per SPEC section 10
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-80 README and disclosures

- **Owner:** Teammate C
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Spec:** BRIEF hackathon facts

**Acceptance criteria**

- [ ] A judge can run the app from the README
- [ ] Every model, tool, reused code and dataset is disclosed
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-81 Demo seed and dry run

- **Owner:** CJ
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-04
- **Spec:** BRIEF demo script

**Acceptance criteria**

- [ ] A reset script puts the demo in its starting state
- [ ] The 60 second script runs end to end twice in a row
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-82 Record and post the video

- **Owner:** Teammate B
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-81
- **Spec:** BRIEF demo script

**Acceptance criteria**

- [ ] About one minute
- [ ] Posted on X or LinkedIn tagging Cognition with #AppBuildersPH
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-83 Pitch and Q&A rehearsal

- **Owner:** Teammate A
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-81
- **Spec:** BRIEF

**Acceptance criteria**

- [ ] 5 minute pitch timed
- [ ] Q&A answers from the brief rehearsed
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-84 Submit on Cerebral Valley

- **Owner:** CJ
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 0.5 h
- **Depends on:** BYT-80, BYT-82
- **Spec:** BRIEF hackathon facts

**Acceptance criteria**

- [ ] Submitted by 9:15 AM
- [ ] Team members match the official list
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output
