## Issue

BYT-<n> <issue title>

<!-- Linear link: https://linear.app/... if the GitHub integration does not add it -->

## What changed

<!-- One line per plan step. -->

## Screen

<!-- For UI issues: each screenshot from tmp/byt-<n>/ next to the matching PNG from design/png, at 390px for phones or 1440px for the hub. Delete this section for non-UI work. -->

| Design | Build |
|---|---|
| | |

## Acceptance criteria

<!-- Every criterion from the issue. Passed ones say how they were checked. Unchecked ones say what manual check they need. -->

- [x] <criterion>: <how it was checked>
- [ ] <criterion>: needs a manual check on <real phone, real model, ...>

## Checks

- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass
- [ ] Tokens and shared components only, no hex or arbitrary values
- [ ] Stayed inside my ownership area, or the owner reviewed
- [ ] No network requests outside the hub

## Needs from others

<!-- Contract changes, new dependencies, shared components, or a blocker this was built around. Write "None" if there are none. -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
