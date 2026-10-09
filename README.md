# Ulat

Offline disaster damage reporting for LGUs. One laptop and one Wi-Fi router, no internet. Families report what happened to their homes by voice, responders verify with photos, and the MDRRMO gets a situation report within the 72-hour window. A local AI model on the laptop does the reading and drafting.

Built by team ByteSized for App Builders PH Hackathon 2026, theme Local AI.

- **Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH
- **Docs:** `docs/BRIEF.md` (why), `docs/SPEC.md` (what), `DESIGN.md` (look), `docs/PLAN.md` (how and when), `docs/WORKFLOW.md` (how the team works), `docs/ISSUES.md` (tasks)

## Run it

> Fill this in as the build lands. Judges must be able to recreate the demo from these steps.

1. Install Node 22, pnpm, Ollama
2. `ollama pull gemma4:e4b`
3. `pnpm install && pnpm db:push && pnpm db:seed`
4. `pnpm build && pnpm start`
5. Open http://localhost:3000 for the family app, /r for responders, /hub for the MDRRMO hub
6. Optional field setup with router, certificate and local DNS: `infra/README.md`

Without the model: `MOCK_AI=1 pnpm dev`.

## Disclosures

> Required by the hackathon rules. Keep this list complete.

- Models: Gemma 4 E4B through Ollama, running on the hub laptop. [whisper.cpp, if used]
- AI coding tools: Claude Code. [Add any others the team used]
- Reused code: CJ's starter kit (starter-kit-web) for the Next.js, Tailwind and shadcn setup, the shadcn components in `src/components/ui`, the time helpers in `src/lib/time`, the ESLint and Vitest config, and the rule tests for hex values, arbitrary values and dashes. Its auth, Postgres, mail and analytics were removed.
- Data: map data from OpenStreetMap through Protomaps, barangay boundaries from HDX [check license], test photos from Wikimedia Commons with their licenses in `eval/SOURCES.md`

## Team

ByteSized: CJ Jutba [add teammates]
