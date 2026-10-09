# How the team works

**Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH. Share it with all four of you from the canvas Share button.

## Linear

Set this up once, in about ten minutes.

- **Team:** ByteSized. Linear gives issues the team's key, written here as `BYT`.
- **Milestones:** one per phase in `docs/PLAN.md`, from "0 Foundation" to "5 Ship and submit". Filter the board by the current milestone.
- **Foundation gate:** BYT-59 blocks every tier 1 issue. CJ closes it when main is ready, and that starts parallel work.
- **Project:** "Ulat", with the canvas link in the project description.
- **Labels:** `family`, `responder`, `hub`, `platform`, `ai`, `infra`, `demo`.
- **Priority means tier:** Urgent is tier 1, High is tier 2, Medium is tier 3, Low is anything after the hackathon.
- **Estimates:** hours, from `docs/ISSUES.md`.
- **Assignee:** CJ for platform, AI and demo. Artkin for family. James for responder. Sean for hub.
- **Issue body:** Linear is the source of truth. `docs/ISSUES.md` is the offline fallback and uses the same IDs.
- **GitHub integration:** connect the repo so a branch name with the issue ID links the PR, and merging moves the issue to Done.
- **Views:** a board grouped by assignee for checkpoints, and "My issues" for each person.

## Git

- `main` is always deployable to the hub.
- Branch per issue, named from Linear's "copy git branch name", for example `cj/byt-12-family-home`.
- Each person works in a git worktree per issue, so Claude Code sessions never share files:

```bash
git worktree add ../ulat-byt-12 -b cj/byt-12-family-home
cd ../ulat-byt-12 && pnpm install && claude
```

- Commits follow Conventional Commits with the issue ID, one plan task per commit, for example `feat(family): voice note recording BYT-36`.
- PRs stay small: one issue, ideally under 400 lines. Rebase on `main` before merging.
- CJ merges contract, schema and dependency changes. Feature owners merge their own PRs once checks pass.

### Files that cause conflicts

Only the Platform owner edits these. Everyone else asks in the PR or in chat.

- `package.json` and the lockfile
- `src/db/schema.ts` and migrations
- `src/lib/contracts/**`
- `src/app/globals.css` and `src/components/ui/**`

If you need a new shared component, build it inside your own area first. CJ moves it into `ui` later.

## Claude Code

- Every person runs Claude Code in their worktree. `CLAUDE.md` imports `AGENTS.md`, so the rules load every session. Teammates using Codex or Cursor read `AGENTS.md` directly.
- Use the import, not a symlink. Symlinks need admin rights on Windows.
- Start each session with `/issue BYT-<n>`. It fetches the issue from Linear, reads the spec and screens, and plans before editing. Without the skill, use this prompt shape:

```
Work on BYT-36 from Linear.
Screen: design/screens/family/voice-note-ready.html and design/png/family/voice-note-ready.png.
Read DESIGN.md and the SPEC section the issue lists. Plan first, then build. Stay inside src/app/(family) and src/components/family.
Done means the acceptance criteria pass, pnpm typecheck && pnpm test pass, and the page matches the PNG at 390px.
```

- `/plan`, `/feature` and `/verify` from the starter kit fit this flow.
- If Claude Code wants to change a contract or add a dependency, stop and post in chat instead.
- Windows teammates without Ollama use `MOCK_AI=1`. For real AI during development, CJ exposes Ollama over Tailscale with `OLLAMA_HOST=0.0.0.0`, and you point `OLLAMA_URL` at CJ's Tailscale address.

## Talking

- Keep one voice call open all night, muted by default.
- Checkpoints at 6:30 PM, 9:00 PM, 11:00 PM, 2:30 AM and 5:30 AM. Ten minutes each, using the Linear board grouped by assignee. Each person says what's done, what's next and what's blocking.
- Blocked means waiting on someone else. Add the `blocked` label, comment why in Linear, and say it in chat. Then pick another issue from your area.
- When a contract changes, CJ posts in chat. Everyone rebases.

## Definition of done

- Acceptance criteria in the issue pass.
- `pnpm typecheck && pnpm test` pass.
- The screen matches its PNG at 390px for phones or 1440px for the hub, using tokens and shared components only.
- Works with `MOCK_AI=1`.
- The PR has a screenshot or command output as evidence.
