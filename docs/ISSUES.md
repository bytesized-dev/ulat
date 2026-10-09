# Ulat issues

**Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH

Linear is the source of truth for owners, scope and order. This file is the original draft, kept as the offline fallback for `/issue`. IDs here match Linear. BYT-54 to BYT-59 exist only in Linear.

Priority means tier: Urgent is tier 1, High is tier 2, Medium is tier 3. Milestones are the phases in `docs/PLAN.md`. Nothing in milestone 1 starts until BYT-59, the foundation gate, is closed.

## Summary

| ID | Title | Owner | Milestone | Label | Priority | Hours |
|---|---|---|---|---|---|---|
| BYT-1 | Repo from the starter kit with SQLite | CJ | 0 Foundation | platform | Urgent | 1 |
| BYT-2 | Risk check: HTTPS on the local network | Artkin | 0 Foundation | infra | Urgent | 1.5 |
| BYT-3 | Risk check: eval photos and voice notes | James | 0 Foundation | ai | Urgent | 1.5 |
| BYT-4 | Risk check: offline map package and MapView | Sean | 0 Foundation | hub | Urgent | 1.5 |
| BYT-5 | Risk check: Ollama and Gemma 4 E4B | CJ | 0 Foundation | ai | Urgent | 0.5 |
| BYT-7 | Design tokens and fonts | CJ | 0 Foundation | platform | Urgent | 0.5 |
| BYT-8 | Database schema, contracts, seed and mock AI | CJ | 0 Foundation | platform | Urgent | 1 |
| BYT-12 | UI kit components | CJ | 0 Foundation | platform | Urgent | 1.5 |
| BYT-59 | Foundation gate: start parallel work | CJ | 0 Foundation | platform | Urgent | 0 |
| BYT-10 | Set home location | Artkin | 1 Tier 1 | family | Urgent | 1 |
| BYT-13 | Reports API | Artkin | 1 Tier 1 | family | Urgent | 1.5 |
| BYT-14 | Entries API and audit trail | James | 1 Tier 1 | responder | Urgent | 2.5 |
| BYT-15 | Live events | CJ | 1 Tier 1 | platform | Urgent | 1 |
| BYT-16 | Summary queries | Sean | 1 Tier 1 | hub | Urgent | 1 |
| BYT-21 | Family home | Artkin | 1 Tier 1 | family | Urgent | 1 |
| BYT-22 | Report start: whose household | Artkin | 1 Tier 1 | family | Urgent | 1 |
| BYT-23 | Responder sign in | James | 1 Tier 1 | responder | Urgent | 1 |
| BYT-24 | Hub shell | Sean | 1 Tier 1 | hub | Urgent | 1 |
| BYT-26 | Before you send and report sent | Artkin | 1 Tier 1 | family | Urgent | 1.5 |
| BYT-27 | Status by code | Artkin | 1 Tier 1 | family | Urgent | 1 |
| BYT-33 | Situation report, SMS and CSV | Sean | 1 Tier 1 | hub | Urgent | 1.5 |
| BYT-36 | Voice note: ready, recording, reading, retry, microphone off | Artkin | 1 Tier 1 | family | Urgent | 2.5 |
| BYT-38 | To visit list | James | 1 Tier 1 | responder | Urgent | 1.5 |
| BYT-39 | Hub overview | Sean | 1 Tier 1 | hub | Urgent | 2 |
| BYT-40 | Hub map | Sean | 1 Tier 1 | hub | Urgent | 1 |
| BYT-46 | Check your report | Artkin | 1 Tier 1 | family | Urgent | 2 |
| BYT-47 | Family report detail | James | 1 Tier 1 | responder | Urgent | 1 |
| BYT-50 | Capture photos and note | James | 1 Tier 1 | responder | Urgent | 2 |
| BYT-52 | Drafting, check the draft, unclear and confirmed | James | 1 Tier 1 | responder | Urgent | 2.5 |
| BYT-54 | Sign in and sessions for responders and staff | CJ | 1 Tier 1 | platform | Urgent | 1 |
| BYT-55 | Hub status and health API | CJ | 1 Tier 1 | platform | Urgent | 1 |
| BYT-56 | Updates, map places and safe list API | Sean | 1 Tier 1 | hub | Urgent | 1.5 |
| BYT-60 | Add a photo to an entry and draft again | James | 1 Tier 1 | responder | Urgent | 1.5 |
| BYT-9 | AI: voice and text to fields | CJ | 2 Real AI loop | ai | Urgent | 2 |
| BYT-25 | AI: photos to damage class | CJ | 2 Real AI loop | ai | Urgent | 2 |
| BYT-58 | End to end smoke test of the demo loop | CJ | 2 Real AI loop | platform | High | 1 |
| BYT-11 | Map, updates and safe list | Artkin | 3 Tier 2 | family | High | 2 |
| BYT-17 | Simulation mode and clear data | CJ | 3 Tier 2 | platform | High | 0.5 |
| BYT-19 | Type instead | Artkin | 3 Tier 2 | family | High | 1 |
| BYT-20 | Updates, translations and map points | Sean | 3 Tier 2 | hub | High | 2 |
| BYT-28 | Family reports and assigning | Sean | 3 Tier 2 | hub | High | 1.5 |
| BYT-29 | Safe list and help desk | Sean | 3 Tier 2 | hub | High | 2 |
| BYT-30 | Review, second look | Sean | 3 Tier 2 | hub | High | 1.5 |
| BYT-31 | All entries and entry detail | Sean | 3 Tier 2 | hub | High | 2 |
| BYT-37 | Report for a neighbor | Artkin | 3 Tier 2 | family | High | 1 |
| BYT-42 | Eval script | CJ | 3 Tier 2 | ai | High | 1.5 |
| BYT-44 | Offline queue and saved on phone | Artkin | 3 Tier 2 | family | High | 2 |
| BYT-48 | Responder map, done and queue tabs | James | 3 Tier 2 | responder | High | 2 |
| BYT-51 | Edit sheet and what we heard sheet | Artkin | 3 Tier 2 | family | High | 1 |
| BYT-53 | House with no report and can't assess | James | 3 Tier 2 | responder | High | 1.5 |
| BYT-57 | AI: translate updates to Bisaya and Tagalog | CJ | 3 Tier 2 | ai | High | 0.5 |
| BYT-32 | Possible duplicates | Sean | 4 Tier 3 | hub | Medium | 1.5 |
| BYT-41 | Lock screen and low battery | Sean | 4 Tier 3 | hub | Medium | 1 |
| BYT-43 | Printable situation report and join poster | Sean | 4 Tier 3 | hub | Medium | 1 |
| BYT-49 | Kit setup, checklist and AI check pages | Sean | 4 Tier 3 | hub | Medium | 2 |
| BYT-6 | README and disclosures | CJ | 5 Ship | demo | Urgent | 1 |
| BYT-18 | Demo seed and dry run | CJ | 5 Ship | demo | Urgent | 1 |
| BYT-34 | Record and post the video | CJ | 5 Ship | demo | Urgent | 1.5 |
| BYT-35 | Pitch and Q&A rehearsal | CJ | 5 Ship | demo | Urgent | 1 |
| BYT-45 | Submit on Cerebral Valley | CJ | 5 Ship | demo | Urgent | 0.5 |

Hours per person: Artkin 20, CJ 20, James 15.5, Sean 24.

---

## BYT-1 Repo from the starter kit with SQLite

- **Owner:** CJ
- **Milestone:** 0 Foundation
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

## BYT-7 Design tokens and fonts

- **Owner:** CJ
- **Milestone:** 0 Foundation
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 0.5 h
- **Depends on:** BYT-1
- **Spec:** DESIGN.md

**Acceptance criteria**

- [ ] `design/tokens.css` is in `globals.css` and Tailwind utilities use the token names
- [ ] Inter and JetBrains Mono load through `next/font` with no request to Google at runtime
- [ ] The starter kit rule tests still pass: no hex in components, no arbitrary values, no dashes in copy
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-12 UI kit components

- **Owner:** CJ
- **Milestone:** 0 Foundation
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-7
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

## BYT-8 Database schema, contracts, seed and mock AI

- **Owner:** CJ
- **Milestone:** 0 Foundation
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-1
- **Spec:** 3, 10

**Acceptance criteria**

- [ ] Drizzle schema matches SPEC section 3
- [ ] `src/lib/contracts` from the scaffold is in place and exported
- [ ] `pnpm db:seed` loads `seed/simulation.json` and the hub totals match the canvas: 46 houses, 14 totally, 23 partially, 9 none, 58 families, 241 people, 6 hurt, 1 missing, 17 waiting
- [ ] `MOCK_AI=1` makes every AI call return fixtures
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-2 Risk check: HTTPS on the local network

- **Owner:** Artkin
- **Milestone:** 0 Foundation
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

## BYT-3 Risk check: eval photos and voice notes

- **Owner:** James
- **Milestone:** 0 Foundation
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

## BYT-4 Risk check: offline map package and MapView

- **Owner:** Sean
- **Milestone:** 0 Foundation
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

## BYT-5 Risk check: Ollama and Gemma 4 E4B

- **Owner:** CJ
- **Milestone:** 0 Foundation
- **Label:** ai
- **Priority:** Urgent, tier 1
- **Estimate:** 0.5 h
- **Spec:** 5

**Acceptance criteria**

- [ ] `gemma4:e4b` runs on the hub
- [ ] Photo prompt returns a valid `AiPhotoDraft` on 10 eval photos, accuracy noted
- [ ] Audio input tested with one Bisaya and one Tagalog note, decision recorded: native audio or whisper.cpp. Deferred, see below.
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

**Deferred: the voice recording test.** CJ will record the Bisaya and Tagalog notes in `eval/voice-scripts.md` and run this test once the whole app is wired and the system works end to end, not as part of this risk check. Until then the audio decision is native audio, provisional. So far only an English text-to-speech clip has gone through Gemma 4 E4B. If the recordings fail in the end to end test, the fallback is whisper.cpp.

---

## BYT-21 Family home

- **Owner:** Artkin
- **Milestone:** 1 Tier 1
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-12
- **Spec:** 2
- **Screens:**
  - Family: home: `design/screens/family/home.html`, `design/png/family/home.png`, route `/`

**Acceptance criteria**

- [ ] Matches the PNG at 390px
- [ ] Latest update comes from `GET /api/updates`
- [ ] Every row links to its route
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-22 Report start: whose household

- **Owner:** Artkin
- **Milestone:** 1 Tier 1
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-12
- **Spec:** 2
- **Screens:**
  - Family: whose household: `design/screens/family/whose-household.html`, `design/png/family/whose-household.png`, route `/report`

**Acceptance criteria**

- [ ] Barangay list comes from settings
- [ ] Choice and fields are kept in the report draft in sessionStorage
- [ ] Progress shows step 1 of 4
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-36 Voice note: ready, recording, reading, retry, microphone off

- **Owner:** Artkin
- **Milestone:** 1 Tier 1
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 2.5 h
- **Depends on:** BYT-22
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

## BYT-46 Check your report

- **Owner:** Artkin
- **Milestone:** 1 Tier 1
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-36
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

## BYT-10 Set home location

- **Owner:** Artkin
- **Milestone:** 1 Tier 1
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-4
- **Spec:** 8
- **Screens:**
  - Family: set home location: `design/screens/family/set-home-location.html`, `design/png/family/set-home-location.png`, route `/report/location`

**Acceptance criteria**

- [ ] Uses GPS when allowed, otherwise the center pin on MapView
- [ ] Shows the barangay and purok under the pin
- [ ] Use this spot saves the location to the draft
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-26 Before you send and report sent

- **Owner:** Artkin
- **Milestone:** 1 Tier 1
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-13
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

## BYT-27 Status by code

- **Owner:** Artkin
- **Milestone:** 1 Tier 1
- **Label:** family
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-13
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

## BYT-23 Responder sign in

- **Owner:** James
- **Milestone:** 1 Tier 1
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-12
- **Spec:** 1 roles
- **Screens:**
  - Responder: unlock: `design/screens/responder/unlock.html`, `design/png/responder/unlock.png`, route `/r/sign-in`

**Acceptance criteria**

- [ ] Name list from `responders`, 6 digit PIN pad
- [ ] `POST /api/auth/responder` sets the session
- [ ] All `/r` routes redirect here without a session
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-38 To visit list

- **Owner:** James
- **Milestone:** 1 Tier 1
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-23
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

## BYT-47 Family report detail

- **Owner:** James
- **Milestone:** 1 Tier 1
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-38
- **Spec:** 2
- **Screens:**
  - Responder: family report: `design/screens/responder/family-report.html`, `design/png/responder/family-report.png`, route `/r/reports/[code]`

**Acceptance criteria**

- [ ] Shows counts, needs, voice note with transcript and English
- [ ] Start assessment creates a draft entry and opens capture
- [ ] Can't assess opens the sheet from BYT-53, or links to it if not built yet
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-50 Capture photos and note

- **Owner:** James
- **Milestone:** 1 Tier 1
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-47
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

## BYT-52 Drafting, check the draft, unclear and confirmed

- **Owner:** James
- **Milestone:** 1 Tier 1
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 2.5 h
- **Depends on:** BYT-50, BYT-60
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

## BYT-24 Hub shell

- **Owner:** Sean
- **Milestone:** 1 Tier 1
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-12
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

## BYT-39 Hub overview

- **Owner:** Sean
- **Milestone:** 1 Tier 1
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-24, BYT-16
- **Spec:** 6
- **Screens:**
  - Hub: overview: `design/screens/hub/overview.html`, `design/png/hub/overview.png`, route `/hub`

**Acceptance criteria**

- [ ] Dark hero with totals from `GET /api/hub/summary`
- [ ] Map with all layers, table by barangay, go first, needs and latest
- [ ] Updates live on entry and report events
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-40 Hub map

- **Owner:** Sean
- **Milestone:** 1 Tier 1
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-4, BYT-24
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

- **Owner:** Sean
- **Milestone:** 1 Tier 1
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-16
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

## BYT-13 Reports API

- **Owner:** Artkin
- **Milestone:** 1 Tier 1
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-8
- **Spec:** 3, 4

**Acceptance criteria**

- [ ] `POST /api/reports`, `GET /api/reports/[code]`, `GET /api/reports` validated with Zod
- [ ] Codes use the safe alphabet and are unique
- [ ] Events written for every change
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-14 Entries API and audit trail

- **Owner:** James
- **Milestone:** 1 Tier 1
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 2.5 h
- **Depends on:** BYT-8
- **Spec:** 3, 4, 5

**Acceptance criteria**

- [ ] `POST /api/entries` stores photos and audio under `data/uploads` and creates a draft
- [ ] `PATCH /api/entries/[id]` confirms with `EntryConfirm`, records every changed field in events, and sets needs_review per SPEC section 5
- [ ] Confirming a linked entry sets the report to visited and emits `entry.confirmed`
- [ ] After saving a draft, calls `draftEntry(entryId)` from `src/lib/ai`
- [ ] `GET /api/entries` lists confirmed entries with paging, filters and search, for the hub
- [ ] `GET /api/files/[id]` serves stored photos and audio to signed in responders and staff only
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-60 Add a photo to an entry and draft again

- **Owner:** James
- **Milestone:** 1 Tier 1
- **Label:** responder
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-14
- **Spec:** 4, 5

**Acceptance criteria**

- [ ] `POST /api/entries/[id]/photos` takes one photo and a label as multipart, responders only. It stores the photo with `storeUpload` and adds a `photos` row
- [ ] Refuses a fourth photo, and an entry that isn't a draft
- [ ] Runs `draftEntry(entryId)` from `src/lib/ai/draft-entry` again, the same way `POST /api/entries` does, so `entry.drafted` goes out
- [ ] Writes an `entry.photo_added` event with the actor
- [ ] PATCH counts the unclear rule as met when the entry has an `entry.photo_added` event, and ignores `new_photo_since_unclear` from the body. No contract change
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-9 AI: voice and text to fields

- **Owner:** CJ
- **Milestone:** 2 Real AI loop
- **Label:** ai
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-5
- **Spec:** 5

**Acceptance criteria**

- [ ] `POST /api/ai/voice` and `/api/ai/text` return a valid `AiVoiceExtract`
- [ ] English translation included
- [ ] 60 second timeout and fixtures under `MOCK_AI=1`
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-25 AI: photos to damage class

- **Owner:** CJ
- **Milestone:** 2 Real AI loop
- **Label:** ai
- **Priority:** Urgent, tier 1
- **Estimate:** 2 h
- **Depends on:** BYT-5, BYT-14
- **Spec:** 5

**Acceptance criteria**

- [ ] Runs after an entry is created and emits `entry.drafted`
- [ ] Uses the DSWD definitions prompt and returns `AiPhotoDraft`
- [ ] Invalid output falls back to unclear with the raw output logged
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-15 Live events

- **Owner:** CJ
- **Milestone:** 1 Tier 1
- **Label:** platform
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-8
- **Spec:** 4

**Acceptance criteria**

- [ ] `GET /api/events` streams `HubEvent` messages
- [ ] Family clients only get events for their code, updates and places
- [ ] A small client hook reconnects on drop
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-16 Summary queries

- **Owner:** Sean
- **Milestone:** 1 Tier 1
- **Label:** hub
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-8
- **Spec:** 6

**Acceptance criteria**

- [ ] Totals, per barangay rows, priority and needs come from SQL
- [ ] Seed data reproduces the canvas numbers exactly
- [ ] Unit tests cover the priority rule
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-42 Eval script

- **Owner:** CJ
- **Milestone:** 3 Tier 2
- **Label:** ai
- **Priority:** High, tier 2
- **Estimate:** 1.5 h
- **Depends on:** BYT-3, BYT-25
- **Spec:** 11
- **Screens:**
  - Hub: AI check: `design/screens/hub/ai-check.html`, `design/png/hub/ai-check.png`, route `/hub/ai-check`

**Acceptance criteria**

- [ ] `pnpm eval` writes `eval/results.json` with agreement, accuracy, confusion matrix, timings and per language accuracy
- [ ] Numbers are never edited by hand
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-19 Type instead

- **Owner:** Artkin
- **Milestone:** 3 Tier 2
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 1 h
- **Depends on:** BYT-9
- **Spec:** 2, 5
- **Screens:**
  - Family: type instead: `design/screens/family/type-instead.html`, `design/png/family/type-instead.png`, route `/report/type`

**Acceptance criteria**

- [ ] Text goes to `POST /api/ai/text` and fills the check screen
- [ ] Character count shown, Record instead goes back
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-37 Report for a neighbor

- **Owner:** Artkin
- **Milestone:** 3 Tier 2
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 1 h
- **Depends on:** BYT-22
- **Spec:** 2
- **Screens:**
  - Family: report for a neighbor: `design/screens/family/report-for-a-neighbor.html`, `design/png/family/report-for-a-neighbor.png`, route `/report?for=neighbor`

**Acceptance criteria**

- [ ] `?for=neighbor` shows their house and you sections
- [ ] Report source is neighbor with reporter name and where to find them
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-51 Edit sheet and what we heard sheet

- **Owner:** Artkin
- **Milestone:** 3 Tier 2
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 1 h
- **Depends on:** BYT-46
- **Spec:** 2
- **Screens:**
  - Family: edit a field: `design/screens/family/edit-a-field.html`, `design/png/family/edit-a-field.png`, route `/report/check, sheet`
  - Family: what we heard: `design/screens/family/what-we-heard.html`, `design/png/family/what-we-heard.png`, route `/report/check, sheet`

**Acceptance criteria**

- [ ] Tapping a row opens the edit sheet for that field
- [ ] The voice note row opens the transcript sheet with playback and English
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-11 Map, updates and safe list

- **Owner:** Artkin
- **Milestone:** 3 Tier 2
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-4
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

## BYT-44 Offline queue and saved on phone

- **Owner:** Artkin
- **Milestone:** 3 Tier 2
- **Label:** family
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-26
- **Spec:** 9
- **Screens:**
  - Family: saved on phone: `design/screens/family/saved-on-phone.html`, `design/png/family/saved-on-phone.png`, route `any, state`

**Acceptance criteria**

- [ ] Service worker caches the shell
- [ ] IndexedDB queues reports with audio and photos
- [ ] Saved on phone screen shows the queue and sends when the hub answers
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-48 Responder map, done and queue tabs

- **Owner:** James
- **Milestone:** 3 Tier 2
- **Label:** responder
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-38, BYT-4
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

## BYT-53 House with no report and can't assess

- **Owner:** James
- **Milestone:** 3 Tier 2
- **Label:** responder
- **Priority:** High, tier 2
- **Estimate:** 1.5 h
- **Depends on:** BYT-50
- **Spec:** 2, 3
- **Screens:**
  - Responder: house with no report: `design/screens/responder/house-with-no-report.html`, `design/png/responder/house-with-no-report.png`, route `/r/new`
  - Responder: can't assess a house: `design/screens/responder/cant-assess-a-house.html`, `design/png/responder/cant-assess-a-house.png`, route `/r/reports/[code], sheet`

**Acceptance criteria**

- [ ] New house creates an entry with no report
- [ ] Can't assess sheet posts the reason and note and keeps the report on the list
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-30 Review, second look

- **Owner:** Sean
- **Milestone:** 3 Tier 2
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 1.5 h
- **Depends on:** BYT-14
- **Spec:** 5
- **Screens:**
  - Hub: review: `design/screens/hub/review.html`, `design/png/hub/review.png`, route `/hub/review`

**Acceptance criteria**

- [ ] Lists needs_review entries with the reason
- [ ] Shows AI draft and responder choice side by side
- [ ] Approve, use the AI class, or ask for photos, each written to events
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-28 Family reports and assigning

- **Owner:** Sean
- **Milestone:** 3 Tier 2
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 1.5 h
- **Depends on:** BYT-13
- **Spec:** 4
- **Screens:**
  - Hub: family reports and assigning: `design/screens/hub/family-reports-and-assigning.html`, `design/png/hub/family-reports-and-assigning.png`, route `/hub/review/family-reports`

**Acceptance criteria**

- [ ] Table with filters and counts
- [ ] Selected report shows the voice note and an Assign to list
- [ ] Assigning emits `report.updated` and shows on the responder list
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-31 All entries and entry detail

- **Owner:** Sean
- **Milestone:** 3 Tier 2
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-14
- **Spec:** 3, 4
- **Screens:**
  - Hub: all entries: `design/screens/hub/all-entries.html`, `design/png/hub/all-entries.png`, route `/hub/entries`
  - Hub: entry and audit trail: `design/screens/hub/entry-and-audit-trail.html`, `design/png/hub/entry-and-audit-trail.png`, route `/hub/entries/[id]`

**Acceptance criteria**

- [ ] Paginated, filterable list
- [ ] Detail shows photos, note, AI draft compared with the final entry, location and history from events
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-20 Updates, translations and map points

- **Owner:** Sean
- **Milestone:** 3 Tier 2
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-9
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

## BYT-29 Safe list and help desk

- **Owner:** Sean
- **Milestone:** 3 Tier 2
- **Label:** hub
- **Priority:** High, tier 2
- **Estimate:** 2 h
- **Depends on:** BYT-13
- **Spec:** 2, 4
- **Screens:**
  - Hub: safe list: `design/screens/hub/safe-list.html`, `design/png/hub/safe-list.png`, route `/hub/safe-list`
  - Hub: help desk intake: `design/screens/hub/help-desk-intake.html`, `design/png/hub/help-desk-intake.png`, route `/hub/desk`

**Acceptance criteria**

- [ ] Safe list search and counts
- [ ] Help desk creates a report with source desk, can record a voice note on the laptop, and shows a code slip
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-32 Possible duplicates

- **Owner:** Sean
- **Milestone:** 4 Tier 3
- **Label:** hub
- **Priority:** Medium, tier 3
- **Estimate:** 1.5 h
- **Depends on:** BYT-13, BYT-14
- **Spec:** 6
- **Screens:**
  - Hub: possible duplicates: `design/screens/hub/possible-duplicates.html`, `design/png/hub/possible-duplicates.png`, route `/hub/review/duplicates`

**Acceptance criteria**

- [ ] Detection per SPEC section 6
- [ ] Merge keeps both notes and the higher hurt count, the family keeps the first code
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-43 Printable situation report and join poster

- **Owner:** Sean
- **Milestone:** 4 Tier 3
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

## BYT-49 Kit setup, checklist and AI check pages

- **Owner:** Sean
- **Milestone:** 4 Tier 3
- **Label:** hub
- **Priority:** Medium, tier 3
- **Estimate:** 2 h
- **Depends on:** BYT-42
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

## BYT-41 Lock screen and low battery

- **Owner:** Sean
- **Milestone:** 4 Tier 3
- **Label:** hub
- **Priority:** Medium, tier 3
- **Estimate:** 1 h
- **Depends on:** BYT-24
- **Spec:** 1, 6
- **Screens:**
  - Hub: locked: `design/screens/hub/locked.html`, `design/png/hub/locked.png`, route `/hub/lock`
  - Hub: low battery warning: `design/screens/hub/low-battery-warning.html`, `design/png/hub/low-battery-warning.png`, route `/hub, state`

**Acceptance criteria**

- [ ] Staff PIN unlocks, lock after 10 minutes idle
- [ ] Low battery banner under 20%
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-17 Simulation mode and clear data

- **Owner:** CJ
- **Milestone:** 3 Tier 2
- **Label:** platform
- **Priority:** High, tier 2
- **Estimate:** 0.5 h
- **Depends on:** BYT-8
- **Spec:** 10

**Acceptance criteria**

- [ ] Simulation pill from settings
- [ ] Clear data per SPEC section 10
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-6 README and disclosures

- **Owner:** CJ
- **Milestone:** 5 Ship
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Spec:** BRIEF hackathon facts

**Acceptance criteria**

- [ ] A judge can run the app from the README
- [ ] Every model, tool, reused code and dataset is disclosed
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-18 Demo seed and dry run

- **Owner:** CJ
- **Milestone:** 5 Ship
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-8
- **Spec:** BRIEF demo script

**Acceptance criteria**

- [ ] A reset script puts the demo in its starting state
- [ ] The 60 second script runs end to end twice in a row
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-34 Record and post the video

- **Owner:** CJ
- **Milestone:** 5 Ship
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 1.5 h
- **Depends on:** BYT-18
- **Spec:** BRIEF demo script

**Acceptance criteria**

- [ ] About one minute
- [ ] Posted on X or LinkedIn tagging Cognition with #AppBuildersPH
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-35 Pitch and Q&A rehearsal

- **Owner:** CJ
- **Milestone:** 5 Ship
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 1 h
- **Depends on:** BYT-18
- **Spec:** BRIEF

**Acceptance criteria**

- [ ] 5 minute pitch timed
- [ ] Q&A answers from the brief rehearsed
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output

---

## BYT-45 Submit on Cerebral Valley

- **Owner:** CJ
- **Milestone:** 5 Ship
- **Label:** demo
- **Priority:** Urgent, tier 1
- **Estimate:** 0.5 h
- **Depends on:** BYT-6, BYT-34
- **Spec:** BRIEF hackathon facts

**Acceptance criteria**

- [ ] Submitted by 9:15 AM
- [ ] Team members match the official list
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has a screenshot or output
