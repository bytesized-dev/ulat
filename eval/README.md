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
