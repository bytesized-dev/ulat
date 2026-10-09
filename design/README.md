# Design references

**Canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH

The canvas is the source of truth. It is private to its owner, so every screen is exported here.

- `screens/<app>/<screen>.html` is a standalone copy of the canvas screen. Open it in a browser or read it as markup. It links Google Fonts for viewing only. The app must load fonts through `next/font`.
- `png/<app>/<screen>.png` is a screenshot at the real size: 390px wide for phones, 1440px for the hub, A4 for print.
- `tokens.css` holds the theme tokens. Copy it into `src/app/globals.css`.

Inline styles in these files are for the mockup. Build with tokens and the shared components in `DESIGN.md`. States such as "recording" share a route with their parent screen.

## Family app, 390px

| Screen | Route | Tier | Issue | Files |
|---|---|---|---|---|
| Family: home | `/` | 1 | BYT-21 | [html](screens/family/home.html), [png](png/family/home.png) |
| Family: whose household | `/report` | 1 | BYT-22 | [html](screens/family/whose-household.html), [png](png/family/whose-household.png) |
| Family: report for a neighbor | `/report?for=neighbor` | 2 | BYT-37 | [html](screens/family/report-for-a-neighbor.html), [png](png/family/report-for-a-neighbor.png) |
| Family: voice note, ready | `/report/voice` | 1 | BYT-36 | [html](screens/family/voice-note-ready.html), [png](png/family/voice-note-ready.png) |
| Family: microphone blocked | `/report/voice, state` | 1 | BYT-36 | [html](screens/family/microphone-blocked.html), [png](png/family/microphone-blocked.png) |
| Family: type instead | `/report/type` | 2 | BYT-19 | [html](screens/family/type-instead.html), [png](png/family/type-instead.png) |
| Family: voice note, recording | `/report/voice, state` | 1 | BYT-36 | [html](screens/family/voice-note-recording.html), [png](png/family/voice-note-recording.png) |
| Family: reading the note | `/report/voice, state` | 1 | BYT-36 | [html](screens/family/reading-the-note.html), [png](png/family/reading-the-note.png) |
| Family: note not understood | `/report/voice, state` | 1 | BYT-36 | [html](screens/family/note-not-understood.html), [png](png/family/note-not-understood.png) |
| Family: check your report | `/report/check` | 1 | BYT-46 | [html](screens/family/check-your-report.html), [png](png/family/check-your-report.png) |
| Family: edit a field | `/report/check, sheet` | 2 | BYT-51 | [html](screens/family/edit-a-field.html), [png](png/family/edit-a-field.png) |
| Family: what we heard | `/report/check, sheet` | 2 | BYT-51 | [html](screens/family/what-we-heard.html), [png](png/family/what-we-heard.png) |
| Family: set home location | `/report/location` | 1 | BYT-10 | [html](screens/family/set-home-location.html), [png](png/family/set-home-location.png) |
| Family: before you send | `/report/send` | 1 | BYT-26 | [html](screens/family/before-you-send.html), [png](png/family/before-you-send.png) |
| Family: report sent | `/report/sent` | 1 | BYT-26 | [html](screens/family/report-sent.html), [png](png/family/report-sent.png) |
| Family: status, waiting for visit | `/status` | 1 | BYT-27 | [html](screens/family/status-waiting-for-visit.html), [png](png/family/status-waiting-for-visit.png) |
| Family: status, visited | `/status, state` | 1 | BYT-27 | [html](screens/family/status-visited.html), [png](png/family/status-visited.png) |
| Family: map | `/map` | 2 | BYT-11 | [html](screens/family/map.html), [png](png/family/map.png) |
| Family: updates from MDRRMO | `/updates` | 2 | BYT-11 | [html](screens/family/updates-from-mdrrmo.html), [png](png/family/updates-from-mdrrmo.png) |
| Family: I'm safe | `/safe` | 2 | BYT-11 | [html](screens/family/im-safe.html), [png](png/family/im-safe.png) |
| Family: on the safe list | `/safe/done` | 2 | BYT-11 | [html](screens/family/on-the-safe-list.html), [png](png/family/on-the-safe-list.png) |
| Family: saved on phone | `any, state` | 2 | BYT-44 | [html](screens/family/saved-on-phone.html), [png](png/family/saved-on-phone.png) |

## Responder app, 390px

| Screen | Route | Tier | Issue | Files |
|---|---|---|---|---|
| Responder: unlock | `/r/sign-in` | 1 | BYT-23 | [html](screens/responder/unlock.html), [png](png/responder/unlock.png) |
| Responder: to visit | `/r` | 1 | BYT-38 | [html](screens/responder/to-visit.html), [png](png/responder/to-visit.png) |
| Responder: map | `/r/map` | 2 | BYT-48 | [html](screens/responder/map.html), [png](png/responder/map.png) |
| Responder: done | `/r/done` | 2 | BYT-48 | [html](screens/responder/done.html), [png](png/responder/done.png) |
| Responder: family report | `/r/reports/[code]` | 1 | BYT-47 | [html](screens/responder/family-report.html), [png](png/responder/family-report.png) |
| Responder: can't assess a house | `/r/reports/[code], sheet` | 2 | BYT-53 | [html](screens/responder/cant-assess-a-house.html), [png](png/responder/cant-assess-a-house.png) |
| Responder: house with no report | `/r/new` | 2 | BYT-53 | [html](screens/responder/house-with-no-report.html), [png](png/responder/house-with-no-report.png) |
| Responder: photos and note | `/r/assess/[entryId]` | 1 | BYT-50 | [html](screens/responder/photos-and-note.html), [png](png/responder/photos-and-note.png) |
| Responder: hub drafting | `/r/assess/[entryId]/drafting` | 1 | BYT-52 | [html](screens/responder/hub-drafting.html), [png](png/responder/hub-drafting.png) |
| Responder: check AI draft | `/r/assess/[entryId]/check` | 1 | BYT-52 | [html](screens/responder/check-ai-draft.html), [png](png/responder/check-ai-draft.png) |
| Responder: AI can't tell | `/r/assess/[entryId]/check, state` | 1 | BYT-52 | [html](screens/responder/ai-cant-tell.html), [png](png/responder/ai-cant-tell.png) |
| Responder: entry confirmed | `/r/assess/[entryId]/confirmed` | 1 | BYT-52 | [html](screens/responder/entry-confirmed.html), [png](png/responder/entry-confirmed.png) |
| Responder: waiting to send | `/r/queue` | 2 | BYT-48 | [html](screens/responder/waiting-to-send.html), [png](png/responder/waiting-to-send.png) |

## Hub, 1440px

| Screen | Route | Tier | Issue | Files |
|---|---|---|---|---|
| Hub: overview | `/hub` | 1 | BYT-39 | [html](screens/hub/overview.html), [png](png/hub/overview.png) |
| Hub: low battery warning | `/hub, state` | 3 | BYT-41 | [html](screens/hub/low-battery-warning.html), [png](png/hub/low-battery-warning.png) |
| Hub: locked | `/hub/lock` | 3 | BYT-41 | [html](screens/hub/locked.html), [png](png/hub/locked.png) |
| Hub: review | `/hub/review` | 2 | BYT-30 | [html](screens/hub/review.html), [png](png/hub/review.png) |
| Hub: possible duplicates | `/hub/review/duplicates` | 3 | BYT-32 | [html](screens/hub/possible-duplicates.html), [png](png/hub/possible-duplicates.png) |
| Hub: family reports and assigning | `/hub/review/family-reports` | 2 | BYT-28 | [html](screens/hub/family-reports-and-assigning.html), [png](png/hub/family-reports-and-assigning.png) |
| Hub: map | `/hub/map` | 1 | BYT-40 | [html](screens/hub/map.html), [png](png/hub/map.png) |
| Hub: add a point to the map | `/hub/map/add` | 2 | BYT-20 | [html](screens/hub/add-a-point-to-the-map.html), [png](png/hub/add-a-point-to-the-map.png) |
| Hub: all entries | `/hub/entries` | 2 | BYT-31 | [html](screens/hub/all-entries.html), [png](png/hub/all-entries.png) |
| Hub: entry and audit trail | `/hub/entries/[id]` | 2 | BYT-31 | [html](screens/hub/entry-and-audit-trail.html), [png](png/hub/entry-and-audit-trail.png) |
| Hub: situation report and exports | `/hub/reports` | 1 | BYT-33 | [html](screens/hub/situation-report-and-exports.html), [png](png/hub/situation-report-and-exports.png) |
| Hub: post updates | `/hub/updates` | 2 | BYT-20 | [html](screens/hub/post-updates.html), [png](png/hub/post-updates.png) |
| Hub: safe list | `/hub/safe-list` | 2 | BYT-29 | [html](screens/hub/safe-list.html), [png](png/hub/safe-list.png) |
| Hub: help desk intake | `/hub/desk` | 2 | BYT-29 | [html](screens/hub/help-desk-intake.html), [png](png/hub/help-desk-intake.png) |
| Hub: kit setup | `/hub/setup` | 3 | BYT-49 | [html](screens/hub/kit-setup.html), [png](png/hub/kit-setup.png) |
| Hub: before the storm checklist | `/hub/checklist` | 3 | BYT-49 | [html](screens/hub/before-the-storm-checklist.html), [png](png/hub/before-the-storm-checklist.png) |
| Hub: AI check | `/hub/ai-check` | 3 | BYT-49 | [html](screens/hub/ai-check.html), [png](png/hub/ai-check.png) |

## Print, A4

| Screen | Route | Tier | Issue | Files |
|---|---|---|---|---|
| Situation report, printable A4 | `/hub/reports/[n]/print` | 3 | BYT-43 | [html](screens/print/situation-report.html), [png](png/print/situation-report.png) |
| Join poster for the evacuation center | `/hub/poster` | 3 | BYT-43 | [html](screens/print/join-poster.html), [png](png/print/join-poster.png) |
