# AI test set

Run `pnpm eval`. It writes `results.json`, which the AI check page reads. Never edit the numbers by hand.

## When we test

The photo, voice and power tests below run during testing of the whole app, once every screen and API is wired and the system works end to end. Until then, no number here is final. The BYT-5 risk check only confirmed the model runs: 10 photos, 7 matching the labels, and no voice recordings. The BYT-5 Linear issue has those results.

## Photos

- 40 to 60 photos of typhoon, flood or earthquake damage to houses, openly licensed. Wikimedia Commons is a good source. Record each in `SOURCES.md`.
- Two people label every photo on their own, without discussing, in `labels.csv`. Use the DSWD definitions in `src/lib/ai/prompts.ts`.
- Report: how often the two people agreed, AI accuracy on the photos they agreed on, the confusion matrix, and seconds per photo.

## Voice

- 10 to 15 notes of 15 to 30 seconds in Tagalog, Bisaya, Taglish and English, recorded on a phone in a noisy room.
- Expected fields in `voice.csv`.
- Report per language: transcription quality, fields right, seconds per note.

## Power

Unplug the hub, note the battery, run 100 photo assessments, note the battery again. Report percent per 100 houses and houses per full charge.

## results.json

`pnpm eval` runs `scripts/eval.ts`, which calls the real `draftPhoto` and `readVoice` and reads the battery before and after the photos. It refuses to run with `MOCK_AI=1`. The math is in `src/lib/eval/metrics.ts` and the run in `src/lib/eval/run.ts`.

- Rates are fractions from 0 to 1, not rounded. A rate with nothing to divide by is `null`.
- A photo needs both labels, and they must agree, to count toward AI accuracy and the confusion matrix. Photos with one label or none still run, for timing and battery. Every photo or note left out of a score, and why, is listed in `skipped`.
- A reply the model gets wrong in shape or time counts as `unclear`, like in the app. If Ollama cannot be reached, nothing is written.
- Voice accuracy scores household_head (normalized: case, accents, punctuation and word order ignored), people, hurt, missing and needs (as a set). `what_happened` is not scored, but it is kept in the per-note rows.
- The battery number is `null` when the hub is on AC power, the percent did not drop, or the probe gave nothing. pmset reports whole percents, so run all the photos for it.
- The first call includes loading the model, so the mean seconds per photo runs high. The median does not.
- Voice calls write their raw reply to the audit trail in `data/ulat.db`, the same as in the app.
