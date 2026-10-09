---
name: create-issue
description: Turn a problem into one Linear issue for one owner area. Reads only the code, screen and contracts the problem points to, shows the full issue with questions and a recommendation for each, and creates nothing until the user says go. On go it creates the issue in Linear, attaches the screenshots, adds it to docs/ISSUES.md and commits that on main. Run as /create-issue followed by the problem, with screenshots pasted in.
argument-hint: "<the problem, in your own words>"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Bash(git:*), Bash(gh pr list:*), Bash(node scripts/screen-outline.mjs:*), Bash(curl:*), Bash(wc:*), Bash(file:*), mcp__linear__list_issues, mcp__linear__get_issue, mcp__linear__list_milestones, mcp__linear__save_issue, mcp__linear__prepare_attachment_upload, mcp__linear__create_attachment_from_upload
---

# /create-issue

Write one Linear issue from a problem the user describes. Two phases with a hard gate between them. First you read and show a preview. Then, only after the user says go, you create it. Nothing reaches Linear or git before go.

Problem: `$ARGUMENTS`

If there is no problem, ask for one and stop. Screenshots pasted with the message count as part of the problem.

You write the issue. You never fix the problem, edit app code or start a branch here. `/issue BYT-<n>` does the work later, and it reads what you write, so write for it: owner area, route, spec sections, screen files, acceptance criteria, crossings.

## 1. Read only what the problem points to

1. Find the screen or API. For a screen, grep `design/README.md` for the route or screen name. Its row gives the design files and the issue that built it, which becomes **Follows**. For an API, find its row in `docs/SPEC.md` section 4.
2. Run `node scripts/screen-outline.mjs` on the screen's HTML and look at its PNG in `design/png`. Compare both with the user's screenshots.
3. Read the component or route handler the route renders, and only the shared components and contracts it uses that bear on the problem. Do not map the repository.
4. Collect evidence for every claim as `path:line`. A problem you can't point at in code or in a screenshot does not go in the issue.
5. Look for overlap before writing anything new:
   - `list_issues` on team ByteSized with a few keywords from the problem, for issues that are not Done or Canceled
   - `git branch -a` and `gh pr list` for branches and pull requests touching the same files

   If an open issue already covers the problem, say so and offer to add to it instead. If in-progress work changes the same files, the new issue builds on it and lists it under **Needs**.

## 2. One issue, one owner area

Each problem becomes one issue in one area from the ownership table in `AGENTS.md`: Platform and AI, Family app, Responder app, or Hub.

- Pick the area that owns most of the files the fix touches.
- Files outside that area go under **Crossings**, and CJ reviews them. A small contract change, a new prop on a shared component in `src/components/ui`, or a seed change is a crossing, not a second issue.
- If one issue really can't hold the work, for example because one part must merge before another owner can start, say so in the preview and ask before splitting. Splitting is the exception.
- If the message holds problems for different areas, propose one issue per area, preview them together, and let one go create all of them.

The label is the area: `family`, `responder`, `hub` or `platform`. Use `ai`, `infra` or `demo` when the problem is about the model, the network setup or the demo.

The issue stays unassigned. CJ assigns it. The preview names who owns the area, so he knows who it is for.

## 3. Show the preview

Show the whole issue exactly as it will appear in Linear, then the questions. Do not call any Linear write tool or edit any file in this phase.

### The issue body

Follow this shape. Leave out a line or section that has nothing in it.

```markdown
**Area:** Family app (`src/app/(family)/**`, `src/components/family/**`)
**Reviewer:** CJ
**Follows:** BYTE-46
**Route:** `/report/check`, `src/components/family/check-report-form.tsx`
**Needs:** BYTE-65 for the upload. Sections 1 and 2 can start now.

One short paragraph: what is wrong, where it was seen, and at what width. If the fix departs from the design PNG, add: "This issue's layout overrides `design/screens/<app>/<screen>.html` wherever they disagree. Keep the design's copy."

## 1. <the first problem, in a few words>

Two or three sentences on what is wrong, with `path:line` evidence.

- [ ] One testable criterion per line
- [ ] Another

## 2. <the next problem>

...

## Crossings (CJ reviews)

* `path/outside/the/area.ts`, and why it changes

## Done

- [ ] Every box above checked at 390px
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has screenshots of <the states that prove it>

A real <phone, camera, microphone or model> check is deferred to CJ's final end to end test.
```

The Screenshots section is added on go, after the upload. Use 390px for family and responder screens and 1440px for the hub. Link issues as `BYTE-<n>`, which is how Linear knows them.

Write it the way `AGENTS.md` asks for UI copy: sentence case, plain words, no em dashes, no en dashes, no exclamation marks. Each criterion is something a reviewer can check by looking or by running a command. "Looks better" is not a criterion. "Household, People and Damage rows all have a hairline divider between rows" is.

### Under the issue

1. **Fields**, on one line: title, label, priority, milestone, estimate in hours, blocked by, related to. Priority follows tier, as the top of `docs/ISSUES.md` says: Urgent is tier 1, High is tier 2, Medium is tier 3. Pick the milestone from `list_milestones` on project Ulat to match.
2. **Area owner:** who owns the area in `AGENTS.md`, so CJ knows who to assign.
3. **Screenshots** you will attach, by file path.
4. **Questions.** Ask only what changes the issue: scope, which of two fixes, whether to go beyond the design, whether something belongs in a later issue. Number them. Give each your recommendation and one line on why. Never ask something the code or the design already answers.
5. End with: "Say go to create it, go with changes, or tell me what to change."

"go" accepts every recommendation. "go, but X" applies X first. Anything else, revise the preview, show it again and wait. If CJ names a person when he says go, assign it to them. Otherwise leave it unassigned.

## 4. On go

### Create the issue

`save_issue` with team `ByteSized`, project `Ulat`, the title, the body without the Screenshots section, `labels`, `priority` (1 Urgent, 2 High, 3 Medium), `milestone`, `blockedBy` and `relatedTo`. No assignee unless CJ named one. It lands in Backlog. Linear returns `BYTE-<n>`. The repo writes the same issue as `BYT-<n>`.

### Attach the screenshots

A pasted image shows its file in the conversation as `[Image: source: <path>]`. Use that path, or a path the user gave. If an image has no path, say so after creating the issue and ask the user to save it to a file.

For each image, one at a time, finish all three steps before starting the next. The upload link expires 60 seconds after step 1.

1. Get the size with `wc -c < <path>`. Call `prepare_attachment_upload` with the issue, a short file name such as `check-screen-top.png`, the content type and the size. Give it a title that says what the image shows.
2. Upload the bytes with curl, copying the URL and every header from `uploadRequest` exactly:

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" -X PUT --data-binary @<path> \
     -H "content-type: image/png" \
     -H "cache-control: public, max-age=31536000" \
     -H "x-goog-content-length-range: <size>,<size>" \
     -H 'Content-Disposition: attachment; filename="<name>.png"' \
     "<uploadRequest.url>"
   ```

   Anything but 200 means start again at step 1. A 403 almost always means a header was changed or left out.
3. Call `create_attachment_from_upload` with the issue, the `assetUrl` and the same title.

Then put the images in the body, so they show where people read. Use `save_issue` with a `patch` that inserts this before the first numbered section:

```markdown
## Screenshots

<One line saying what the images show and at what width.>

![<title>](<assetUrl>)

```

### Add it to docs/ISSUES.md

`docs/ISSUES.md` is the offline copy `/issue` falls back to. Never read the whole file.

1. Run `git status --short docs/ISSUES.md`. If it already has changes, still add the issue, but skip the commit below and say why.
2. **Summary row.** Grep `^| BYT-` with line numbers, find the last row in the same milestone, and add after it: `| BYT-<n> | <title> | <assignee first name, or Unassigned> | <milestone> | <label> | <priority> | <hours> |`.
3. **Section.** Grep `^## BYT-` with line numbers and find the highest numbered section. Read from there to its closing `---`, and insert the new section after that line, so new issues stay together. Use this shape:

```markdown
## BYT-<n> <title>

- **Owner:** <assignee first name, or "Unassigned">. <area> area.
- **Milestone:** <milestone>
- **Label:** <label>
- **Priority:** <priority>, tier <tier>
- **Estimate:** <hours> h
- **Depends on:** <BYT ids, or leave the line out>
- **Spec:** <section numbers>
- **Screens:**
  - <Screen name>: `design/screens/<app>/<screen>.html`, `design/png/<app>/<screen>.png`, route `<route>`

<The opening paragraph from the Linear issue. End with "Linear has the full checklist." when the list below is shortened.>

**Acceptance criteria**

- [ ] <the criteria, one per line, shortened where Linear has the detail>
- [ ] `pnpm typecheck && pnpm test` pass, and the PR has <screenshots or output>

---
```

### Commit it on main

Only when the current branch is `main` and step 1 found no earlier changes in the file.

1. `git add docs/ISSUES.md`, and nothing else
2. `git commit -m "docs(issues): add BYT-<n> <title>"`
3. `git push origin main`. If the push is rejected because main moved, run `git pull --rebase origin main` and push again. If it fails for any other reason, stop and show the error.

On any other branch, leave the change uncommitted and say so.

## 5. Report back

A short message:

- the Linear link and `BYTE-<n>`
- the area and who owns it, so CJ can assign it
- how many screenshots were attached, and any that could not be
- the commit hash, or why there was no commit
- anything the user should know before it is picked up, such as an open pull request it builds on
