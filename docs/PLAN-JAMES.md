# James's issue order and blockers

## Context

James owns the responder app (`/r`), the entries API and the Phase 0 eval data. There are 10 issues. The foundation gate BYT-59 is now Done, so the blockers are gone and the work is moving. This plan sets the order, lists what is still blocking and says what to do next.

Checked on 2026-10-09 against Linear and `origin/main`. Local branch is behind `origin/main`, so run `git pull --rebase` first.

## Status

| Issue | Linear status | Notes |
|---|---|---|
| BYT-3 Eval photos and voice notes | In Progress | 68 photos, sources and `label_a` done. No `label_b`, no voice files yet |
| BYT-14 Entries API and audit trail | Done | Merged to main |
| BYT-23 Responder sign in | Done | Merged to main |
| BYT-38 To visit list | In Review | Waiting on review |
| BYT-47 Family report detail | In Review | Waiting on review |
| BYT-50 Capture photos and note | In Review | Waiting on review |
| BYT-60 Add a photo to an entry and draft again | In Review | New issue. Blocks BYT-52 |
| **BYT-52** Drafting, check the draft, unclear and confirmed | **Todo** | Next to build. Only BYT-60 still blocks it |
| **BYT-53** House with no report and can't assess | Backlog | No blockers in Linear. See the BYT-13 note below |
| **BYT-48** Responder map, done and queue tabs | Backlog | Blocked by BYT-4 (In Review, Sean) |

## Blocker status

| Blocker | Owner | Status | Blocks (James) |
|---|---|---|---|
| BYT-59 Foundation gate | CJ | Done | n/a |
| BYT-1, 7, 8, 12, 54, 55, 15 | CJ | Done | n/a |
| BYT-25 AI photos to damage class | CJ | Done | n/a (was blocking 52) |
| BYT-60 Add a photo to an entry | James | In Review | 52 |
| BYT-13 Reports API | Artkin | Code is on main, Linear still says Todo | 53 (related, not blocking) |
| BYT-4 Offline map and MapView | Sean | In Review | 48 |

## Dependency chain (Linear relations)

```
BYT-14 (done) -> BYT-23 (done) -> BYT-38 -> BYT-47 -> BYT-50 -> BYT-60 -> BYT-52 -> BYT-58 smoke test
                                     |                  |
                                     |                  +-> BYT-53 (related to BYT-13)
                                     +-> BYT-48 (blocked by BYT-4)
BYT-3 (free, in progress)
```

## Order of work

| # | Issue | Can start now? | Waiting on | Est. |
|---|---|---|---|---|
| 1 | **BYT-3** Eval photos and voice notes | **Yes**, in progress | people and recordings, not code | 1.5 h |
| 2 | **BYT-52** Drafting, check, unclear, confirmed | **Yes**, once BYT-50 and BYT-60 are merged, or build on top of those branches | BYT-60 review | 2.5 h |
| 3 | **BYT-53** New house and can't assess | **Yes** | BYT-13 should be marked Done in Linear | 1.5 h |
| 4 | **BYT-48** Map, done, queue tabs | Done and queue tabs yes, map no | BYT-4 | 2 h |
| 5 | BYT-38, 47, 50, 60 review fixes | n/a | Reviewer comments | as needed |

Order reasoning: BYT-52 is on the demo loop and BYT-58 (end to end smoke test) waits on it, so it goes first. BYT-53 has no blockers and is small. BYT-48 goes last because the map part needs Sean's MapView. If BYT-4 is not merged when you get there, build the Done and Queue tabs first and the map last.

## What to do next

1. **`git pull --rebase`.** Main has moved a lot: CJ's sessions, live events, hub status, and your BYT-14, BYT-23 work are all there.
2. **Check review on BYT-38, 47, 50 and 60.** Branch BYT-52 off the latest of those if they are not merged. BYT-52 needs the BYT-60 photo route.
3. **Start BYT-52** with `/issue BYT-52`. BYT-25 is done, so you can use the real `draftEntry` and `MOCK_AI=1` for fixtures.
4. **Then BYT-53.** The `cant-assess` route lives in Artkin's folder (`src/app/api/reports/[code]/cant-assess`), so Artkin has to review it. Ask Artkin to move BYT-13 to Done, since the reports API is merged.
5. **BYT-48 Done and Queue tabs**, then the map when BYT-4 merges.
6. **Keep going on BYT-3 in the gaps:**
   - Send the first 10 labeled photos to CJ (CJ's BYT-5 is already Done, so confirm whether that deadline still matters).
   - Get `label_b` from Artkin or Sean using `eval/label-sheet-for-second-labeler.csv`.
   - Record 10 to 15 voice notes from `eval/VOICE-SCRIPTS.md` into `eval/voice`. Names must match `eval/voice.csv`.
   - Cut photos from 68 to 60 or fewer. Move the extras to `eval/rejected/` and drop their rows from `labels.csv` and `SOURCES.md`.
   - Run `node scripts/check-eval.mjs` until it is clean.
   - Commit or drop the untracked files: `eval/CANDIDATES.md`, `eval/label-tool.html`, `eval/rejected/`, `docs/PLAN-JAMES.md`.

## Risks to raise with the team

1. **Linear and main disagree on BYT-13.** The reports API commits are on main but the issue is Todo. Ask Artkin to update it.
2. **BYT-53 owns a route in Artkin's folder.** Artkin has to review it.
3. **BYT-48 needs Sean's MapView (BYT-4).** Still In Review. Build Done and Queue first.
4. **BYT-52 is blocked only by BYT-60.** Get BYT-60 reviewed and merged quickly.
5. **Hard rule:** work only inside James's area (`src/app/r/**`, `src/components/responder/**`, `src/app/api/entries/**`, `src/app/api/files/**`). Any contract, schema or dependency change goes to CJ.

## Execution rules per issue

One issue, one branch (use the `gitBranchName` Linear gives), one worktree. Start with `/issue BYT-<n>`. Done means acceptance criteria pass, `pnpm typecheck && pnpm test` pass, and the screen matches its PNG at 390px.

## Verification

- BYT-3: `eval/photos` has 40 to 60 files, every one has a row in `eval/SOURCES.md` and two labels in `eval/labels.csv`, and `eval/voice` matches `eval/voice.csv`.
- Plan accuracy: re-check Linear statuses before starting each issue.
