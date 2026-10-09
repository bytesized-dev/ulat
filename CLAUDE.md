@AGENTS.md

## Claude Code

If the starter kit already had a CLAUDE.md, keep its content below this section. Do not delete the kit's rules.

- Start every task by reading the issue in `docs/ISSUES.md`, then the screen HTML in `design/screens` and its PNG in `design/png`. Write a short plan before editing.
- Use the starter kit skills: `/plan` before a feature, `/feature` to build it, `/verify` before you say it is done.
- One issue per session and per git worktree. Do not start a second issue in the same session.
- Stay inside your ownership area from AGENTS.md. If the issue needs a contract or dependency change, stop and say so instead of making it.
- When turning a `design/screens` HTML file into components, keep the structure and the copy, replace inline styles with tokens and the shared components in `src/components/ui`, and never copy hex values.
- Never add a network request to a host outside the hub. If something seems to need the internet, stop and ask.
- Run `pnpm typecheck && pnpm test` and open the page in the browser before reporting done. Show the output.
