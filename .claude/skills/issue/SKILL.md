---
name: issue
description: Work one Linear issue end to end. Fetches the BYT issue from Linear, reads its spec and design screens, writes a plan, works in its own git worktree, verifies against the acceptance criteria and the design PNG, and opens a pull request for review. Never merges. Run as /issue BYT-21, or /issue BYT-21 auto to skip the pause after the plan.
argument-hint: "<BYT-number> [auto]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(git:*), Bash(pnpm:*), Bash(node scripts/screen-outline.mjs:*), Bash(npx playwright screenshot:*), Bash(gh auth status), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr list:*), mcp__linear__get_issue, mcp__linear__list_comments, mcp__linear__save_issue, mcp__linear__save_comment
---

# /issue

Take one Linear issue from Todo to an open pull request. A human reviews and merges it. You never merge, approve, or push to main.

Arguments: `$ARGUMENTS`

- The first argument is the issue ID, such as `BYT-21`. Accept `byt-21` or plain `21` and normalize to `BYT-21`. If there is no ID, ask for one and stop.
- If the second argument is `auto`, skip the pause after the plan. Otherwise pause once, after the plan.

The project rules in `AGENTS.md` apply the whole time. This skill adds the order of work on top of them.

## 1. Fetch the issue

Use the Linear tool `get_issue` with the ID, then `list_comments` on it. Read the title, description, labels, status, assignee and blocked by relations. The description holds the owner, tier, spec sections, screen files and acceptance criteria. Comments can hold decisions that change the spec, so read them too.

If the Linear tools are missing or fail, read only that issue from `docs/ISSUES.md`, never the whole file. Grep for `^## BYT-<n> ` with line numbers, then Read from that line up to the next `---`. Tell the user to run `/mcp` and sign in to Linear for next time.

When Linear works, it is the source. Do not also read the issue in `docs/ISSUES.md`.

Stop if the issue is Done or Canceled. If it is In Review, ask whether to continue on the existing pull request instead of starting a new one.

## 2. Check that it is ready

**Blockers.** For each blocking issue, check whether its work is on main, either Done in Linear or a commit mentioning it in `git log origin/main --oneline`.

- If a blocker is platform work this issue builds on (repo, tokens, schema, contracts, UI kit, or an API this issue calls), stop and name it. Building without it means doing the work twice.
- If the missing blocker is another screen, continue without it, and say so in the pull request.

**Non-code issues.** Risk checks, collecting eval photos, the video, the pitch and the submission need no worktree or pull request. Show the acceptance criteria as a checklist, help the user through it, and at the end post a short Linear comment with the results.

## 3. Read before planning

Read only what the issue points to, in this order:

1. The SPEC sections the issue lists, not the whole of `docs/SPEC.md`. Grep it for `^## ` with line numbers, then Read each listed section with offset and limit.
2. `DESIGN.md`, for any UI work.
3. Each screen in the issue. For structure and exact copy, run `node scripts/screen-outline.mjs design/screens/<app>/<screen>.html`. Pass several files in one call. Do not Read the raw HTML. Most of each file is mockup CSS and SVG paths you must not copy, and the outline is about a sixth of the size. For how it should look, open the PNG in `design/png` and look at it once. Icons show as `svg.i` in the outline, so take them from the PNG.
4. The contracts in `src/lib/contracts` that the screen or API uses.
5. In the issue's area and in `src/components/ui`, list the files with Glob, then Read only the ones the plan will use or change, so you reuse instead of rebuilding. Do not read the area file by file.

## 4. Plan

Write a short numbered plan. Each step should be small enough to be one commit. Include:

- files to create or change, all inside the owner's area from `AGENTS.md`
- shared components you will reuse
- where the data comes from: the real API, seed data, or mock AI fixtures
- how you will check each acceptance criterion
- a "needs from others" list for anything outside the area, such as a contract change, a new dependency or a new shared component. Do not make those changes yourself.

Put the steps in your todo list. Unless the second argument is `auto`, show the plan and wait for the user to say go. Reading a plan takes half a minute and catches a misread issue before an hour goes into it. If the user changes the plan, update it.

## 5. Work in its own worktree

Each issue gets its own worktree, so parallel sessions never touch each other's files.

- If the session is already inside `.claude/worktrees/byt-<n>`, use it.
- Otherwise run `git fetch origin`, then use the EnterWorktree tool with the name `byt-<n>`, lowercase. Its branch name contains the issue ID, which is what lets Linear link the pull request.
- Bring it up to date: if the worktree has no commits of its own yet, run `git merge --ff-only origin/main`.
- If the EnterWorktree tool is not available, run `git worktree add .claude/worktrees/byt-<n> -b byt-<n> origin/main`, tell the user to open a new terminal with `cd .claude/worktrees/byt-<n> && claude` and run `/issue BYT-<n>` there, and stop. Editing another directory from a session rooted somewhere else is error prone.

Set up the worktree:

- `pnpm install --frozen-lockfile`
- `.env.local` should arrive through `.worktreeinclude`. If it is missing, copy it from the main checkout, three levels up.
- Give the worktree its own database with `pnpm db:push && pnpm db:seed`, so its data never collides with another session.
- Use port `3000 + n` for the dev server, for example `PORT=3021` for BYT-21, so several sessions can run at once.

Then set the Linear issue to In Progress with `save_issue`, and assign it to `me` if it has no assignee.

## 6. Build

Follow the plan one step at a time and commit after each step with a Conventional Commit that ends with the issue ID:

```
feat(family): voice note recording BYT-36
fix(hub): barangay table totals BYT-39
test(platform): priority rule BYT-16
```

Keep the `AGENTS.md` rules in mind the whole time. The ones that matter most here:

- design tokens and shared components only, no hex and no arbitrary values
- copy taken from the design HTML
- no network requests outside the hub
- Zod contracts at every boundary
- stay inside your area

Stop and ask instead of pushing through when:

- the work needs a change to `src/lib/contracts`, `src/db`, `package.json`, `src/app/globals.css` or `src/components/ui` and the issue is not a platform issue
- the issue is turning out much bigger than its estimate. Propose a split.
- the spec and the design disagree. Describe both and ask which wins.

## 7. Verify

Evidence before claims. Never say something works without having run it.

1. Run `pnpm typecheck && pnpm lint && pnpm test`. Fix failures. Never skip or delete a test to get green.
2. For UI issues, start the dev server on the issue port and screenshot every route and state in the issue: `npx playwright screenshot --viewport-size=390,844 http://localhost:<port><route> tmp/byt-<n>/<screen>.png`. Use 390 by 844 for phones and 1440 by 900 for the hub. Look at your screenshot next to the design PNG, fix visible differences in layout, spacing, copy and color, and screenshot again. Do at least one pass.
3. Walk through every acceptance criterion. Mark each one as passed with how you checked it, or as needing a manual check when it requires something you can't do here, such as a real phone or the real model. Never mark a criterion passed that you did not check.
4. Run `git fetch origin && git rebase origin/main`. If anything changed, run the checks again.

## 8. Open the pull request

1. `git push -u origin HEAD`
2. Write the body from `pr-body.md` in this folder to `tmp/byt-<n>/pr.md`, then run `gh pr create --base main --title "BYT-<n> <issue title>" --body-file tmp/byt-<n>/pr.md`. Open it ready for review, not as a draft. It can merge once the CI `check` job passes. If it touches a path in `.github/CODEOWNERS`, such as the contracts or `package.json`, it also waits for CJ's approval.
3. If `gh` is not installed or not signed in, push anyway, print the compare link `https://github.com/bytesized-dev/ulat/compare/main...<branch>`, and tell the user to run `gh auth login`.
4. Set the Linear issue to In Review. Add a Linear comment with the pull request link if the GitHub integration has not linked it already.

Never merge, approve or force push to main. The teammate merges the PR after checking it, or CJ does when the PR needs CJ's review.

## 9. Report back

End with a short message:

- the pull request link
- acceptance criteria: how many passed, and which need a manual check
- anything needed from others
- how to try it: `cd .claude/worktrees/byt-<n> && PORT=<port> pnpm dev`, then the URL

Remind the user that after the pull request is merged they can remove the worktree with `git worktree remove .claude/worktrees/byt-<n>`.
