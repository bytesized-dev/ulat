# Ulat build plan

**Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH

Four people, one night, a hard 10:00 AM deadline. The canvas has 54 screens. The plan builds the demo loop first, then widens. Times assume a 5:00 PM start. Shift them if you start later, but keep the freeze and submit times fixed.

## Roles

| Person | Area | Owns |
|---|---|---|
| CJ | Platform and AI | Repo, database, contracts, UI kit, API, AI pipeline, events, eval, infra, merging |
| Teammate A | Family app | Every `/` screen, plus the HTTPS risk check in phase 0 |
| Teammate B | Responder app | Every `/r` screen, plus the eval set in phase 0 |
| Teammate C | Hub | Every `/hub` screen and the shared map component, plus the offline map in phase 0 |

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

1. **BYT-01** Repo from the starter kit, SQLite instead of Neon, Better Auth removed. Push to `bytesized-dev/ulat`, public.
2. **BYT-02** Tokens from `design/tokens.css` and fonts through `next/font`.
3. **BYT-04** Drizzle schema from `docs/SPEC.md` section 3, contracts copied from this scaffold, seed loader, `MOCK_AI` fixtures.
4. **BYT-03** UI kit from `DESIGN.md`: Button, TopBar, AppTopBar, ProgressSteps, Row, IconPlate, Pill, StatusDot, Chip, Segmented, Counter, inputs, Sheet, Timeline, DarkHero, TabBar, HubShell. A `/dev/kit` page shows them all.
5. **BYT-08** Ollama smoke test on CJ's Mac.

At the same time, the others do the risk checks, which need no app code:

- **Teammate A, BYT-05:** router, Caddy, certificate and dnsmasq. Prove that camera, microphone and GPS work over HTTPS on one Android phone and one iPhone with mobile data off.
- **Teammate B, BYT-06:** collect and double-label the eval photos, record the voice notes.
- **Teammate C, BYT-07:** extract the town's map tiles, glyphs, sprites and barangay boundaries, and build the MapLibre component in isolation.

**Gate at 6:30 PM:** main builds, `/dev/kit` renders, `pnpm db:seed` works, and all three risk checks report back. Results change the spec here:

- HTTPS failed: use Caddy's internal certificate on the demo phones and skip family voice on personal phones.
- Gemma audio failed: switch to whisper.cpp.
- Photo accuracy below about 7 in 10: try `gemma4:26b` for photos.
- Bisaya transcription poor: keep typing and the help desk as the fallback.

## Phase 1: tier 1 screens, 6:30 to 9:00 PM

Each person builds their tier 1 screens from `design/screens` and `design/png` against seed data, with `MOCK_AI=1`. CJ builds the API routes for the loop in parallel.

| Person | Issues |
|---|---|
| CJ | BYT-40 reports API, BYT-41 entries API, BYT-44 events |
| A | BYT-10 to BYT-16, the family report flow and status |
| B | BYT-20 to BYT-24, sign in to entry confirmed |
| C | BYT-45 summary queries, then BYT-30 to BYT-33, hub shell, overview, map, reports |

## Phase 2: the real loop, 9:00 to 11:00 PM

- CJ: BYT-42 voice, BYT-43 photos.
- Everyone swaps fixtures for the real API in their screens and tests on real phones on the hub network.

**Kill rule at 11:00 PM:** if acceptance criteria 1 to 6 don't pass, nobody starts tier 2. Everyone works on the loop until it does.

## Phase 3: tier 2, 11:00 PM to 2:30 AM

| Person | Issues |
|---|---|
| CJ | BYT-46 eval script, BYT-74 simulation mode |
| A | BYT-50 to BYT-54 |
| B | BYT-55, BYT-56 |
| C | BYT-57 to BYT-61 |

## Phase 4: tier 3 and eval, 2:30 to 5:30 AM

| Person | Issues |
|---|---|
| CJ | Run the real eval and fix what it exposes, BYT-81 demo seed |
| A | BYT-83 pitch script, then help wherever the loop is weakest |
| B | BYT-72 setup, checklist, AI check, BYT-73 lock and low battery |
| C | BYT-70 duplicates, BYT-71 print pages |

Tier 3 is optional. Cut it in this order if time runs out: duplicates, lock, low battery, checklist, print pages.

## Phase 5 and 6: ship and submit

- BYT-80 README with exact setup steps and complete disclosures. Teammate C drafts it during phase 4.
- BYT-81 demo seed and a dry run of the 60 second script in `docs/BRIEF.md`.
- BYT-82 record the video, post it on X or LinkedIn tagging Cognition with #AppBuildersPH.
- BYT-83 pitch script and Q&A rehearsal.
- BYT-84 submit on Cerebral Valley by 9:15 AM. The form closes at 10:00 sharp.

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
