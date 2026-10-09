# Ulat build plan

**Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH

Four people, one night, a hard 10:00 AM deadline. The canvas has 54 screens. The plan builds the demo loop first, then widens. Times assume a 5:00 PM start. Shift them if you start later, but keep the freeze and submit times fixed.

## Roles

| Person | Area | Owns |
|---|---|---|
| CJ | Platform and AI | Repo, database, contracts, UI kit, events, sessions, hub status, AI pipeline, eval, Ollama risk check, demo and submission, merging |
| Artkin | Family app | Every `/` screen, the reports API, and the HTTPS risk check in phase 0 |
| James | Responder app | Every `/r` screen, the entries API, and the eval photos and voice notes in phase 0 |
| Sean | Hub | Every `/hub` and print screen, the shared map component, summary queries, the updates, places, safe list, sitrep and export APIs, and the offline map in phase 0 |

Linear milestones match the phases below. BYT-59 is the foundation gate: it blocks every tier 1 issue, and closing it starts parallel work.

Everyone uses Claude Code in their own worktree. CJ can run several sessions in parallel for platform issues.

## Timeline

| Time | Phase | Goal |
|---|---|---|
| 5:00 to 6:30 PM | 0. Foundation | Repo, contracts, UI kit and seed on main. The three risk checks done in parallel |
| 6:30 to 9:00 PM | 1. Tier 1 screens | Every tier 1 screen built against seed data and `MOCK_AI=1` |
| 9:00 to 11:00 PM | 2. Real loop | API, events and real AI wired. The full loop works with the network off |
| 11:00 PM | Checkpoint | Run acceptance criteria 1 to 7 in `docs/SPEC.md`. Kill rule below |
| 11:00 PM to 2:30 AM | 3. Tier 2 | Typing, neighbor, sheets, tabs, review, assign, entries, updates, safe list, desk |
| 2:30 to 5:30 AM | 4. Tier 3 and eval | Duplicates, print pages, setup pages, lock, low battery, real eval numbers |
| 5:30 to 6:00 AM | Freeze | No new features. Fix only what breaks the demo |
| 6:00 to 8:00 AM | 5. Ship | README, disclosures, demo dry run, record the video |
| 8:00 to 9:15 AM | 6. Submit | Post the video, fill the form, submit by 9:15 |

The pitcher sleeps from about 2:00 to 5:00 AM.

## Phase 0: foundation, 5:00 to 6:30 PM

CJ, in this order, merging to main as each lands:

1. **BYT-1** Repo from the starter kit, SQLite instead of Neon, Better Auth removed. Push to `bytesized-dev/ulat`, public.
2. **BYT-7** Tokens from `design/tokens.css` and fonts through `next/font`.
3. **BYT-8** Drizzle schema from `docs/SPEC.md` section 3, contracts copied from this scaffold, seed loader, `MOCK_AI` fixtures.
4. **BYT-12** UI kit from `DESIGN.md`: Button, TopBar, AppTopBar, ProgressSteps, Row, IconPlate, Pill, StatusDot, Chip, Segmented, Counter, inputs, Sheet, Timeline, DarkHero, TabBar, HubShell. A `/dev/kit` page shows them all.
5. **BYT-5** Ollama smoke test on CJ's Mac.

At the same time, the others do the risk checks, which need no app code:

- **Artkin, BYT-2:** router, Caddy, certificate and dnsmasq. Prove that camera, microphone and GPS work over HTTPS on one Android phone and one iPhone with mobile data off.
- **James, BYT-3:** collect and double-label the eval photos, record the voice notes. First 10 labeled photos to CJ by 6:00 PM for BYT-5.
- **Sean, BYT-4:** extract the town's map tiles, glyphs, sprites and barangay boundaries, and build the MapLibre component in isolation.

When your risk check is done, read your first tier 1 screen with `node scripts/screen-outline.mjs` and its PNG, so you start the minute the gate closes.

**Gate at 6:30 PM, BYT-59:** main builds, `/dev/kit` renders, `pnpm db:seed` works, and all four risk checks report back. CJ closes BYT-59 and posts "main is ready, rebase and start". Results change the spec here:

- HTTPS failed: use Caddy's internal certificate on the demo phones and skip family voice on personal phones.
- Gemma audio failed: switch to whisper.cpp.
- Photo accuracy below about 7 in 10: try `gemma4:26b` for photos.
- Bisaya transcription poor: keep typing and the help desk as the fallback.

## Phase 1: tier 1 screens and APIs, 6:30 to 9:00 PM

Each person builds their tier 1 issues from `design/screens` and `design/png` against seed data, with `MOCK_AI=1`. Ship the GET endpoints first, because other people's screens read them.

| Person | Issues, in order |
|---|---|
| CJ | BYT-15 live events, BYT-54 sign in and sessions, BYT-55 hub status. Review and merge PRs as they come |
| Artkin | BYT-13 reports API with `GET /api/reports` first, then BYT-21, BYT-22, BYT-36, BYT-46, BYT-10, BYT-26, BYT-27 |
| James | BYT-14 entries API, then BYT-23, BYT-38, BYT-47, BYT-50, BYT-60, BYT-52 |
| Sean | BYT-56 with `GET /api/updates` first, BYT-16 summary queries, then BYT-24, BYT-39, BYT-40, BYT-33 |

## Phase 2: the real loop, 9:00 to 11:00 PM

- CJ: BYT-9 voice, BYT-25 photos, BYT-58 e2e smoke test.
- Everyone swaps fixtures for the real API in their screens and tests on real phones on the hub network.

**Kill rule at 11:00 PM:** if acceptance criteria 1 to 6 don't pass, nobody starts tier 2. Everyone works on the loop until it does.

## Phase 3: tier 2, 11:00 PM to 2:30 AM

| Person | Issues |
|---|---|
| CJ | BYT-42 eval script, BYT-17 simulation mode, BYT-57 translate |
| Artkin | BYT-19, BYT-37, BYT-51, BYT-11, BYT-44 |
| James | BYT-48, BYT-53 |
| Sean | BYT-30, BYT-28, BYT-31, BYT-20, BYT-29 |

## Phase 4: tier 3 and eval, 2:30 to 5:30 AM

| Person | Issues |
|---|---|
| CJ | Run the real eval and fix what it exposes, BYT-18 demo seed |
| Sean | BYT-32 duplicates, BYT-43 print pages, BYT-49 setup pages, BYT-41 lock and low battery |
| Artkin, James | Fix what the e2e test and phone tests expose, then help Sean with tier 3 if he is behind |

Tier 3 is optional. Cut it in this order if time runs out: duplicates, lock, low battery, checklist, print pages.

## Phase 5 and 6: ship and submit

- BYT-6 README with exact setup steps and complete disclosures. Draft during phase 4.
- BYT-18 demo seed and a dry run of the 60 second script in `docs/BRIEF.md`.
- BYT-34 record the video, post it on X or LinkedIn tagging Cognition with #AppBuildersPH.
- BYT-35 pitch script and Q&A rehearsal.
- BYT-45 submit on Cerebral Valley by 9:15 AM. The form closes at 10:00 sharp.

## Verification

- Every PR: `pnpm typecheck && pnpm test`, a screenshot next to the matching PNG, and the issue's acceptance criteria checked off.
- After phase 2 and before freeze: `pnpm e2e` runs the demo loop in Playwright with `MOCK_AI=1`.
- Before recording: the whole loop on real phones with the router unplugged from the internet.

## Submission checklist

- [ ] Public repo under bytesized-dev with this README filled in
- [ ] Every model, tool, reused code and dataset in the disclosures
- [ ] Video about one minute long, posted on X or LinkedIn tagging Cognition with #AppBuildersPH
- [ ] Every team member on the official list and on the form
- [ ] Submitted on Cerebral Valley by 9:15 AM
- [ ] Someone confirmed to pitch on site
