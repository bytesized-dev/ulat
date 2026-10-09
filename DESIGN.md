# Ulat design system

Coinbase-inspired: a quiet white canvas, near-black ink, soft gray surfaces, and one blue used sparingly. This borrows the style only. No Coinbase logo, fonts or brand assets.

**Canvas with every screen:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH. Exported copies live in `design/screens` and `design/png`.

## Principles

1. **One action color.** Blue is for the primary button, links and the current step. One or two blue moments per screen.
2. **Calm type.** Big headings use weight 400 with tight letter spacing. Never bold a display heading.
3. **Numbers in mono.** Report codes, counts, times, distances and table figures use the mono font.
4. **Red and green are text and dots only.** Never a background fill. Damage classes are a colored dot next to dark text.
5. **Pills and circles.** Every button and chip is a pill. Every icon plate is a circle. Large cards have 24px corners.
6. **Less text.** No subtitles unless the screen fails without one. No helper paragraphs. Labels are one or two words.
7. **Flat.** Lists are flat with hairline dividers, not stacks of bordered cards. One shadow tier, used only on floating map controls and sheets.
8. **Dark hero for the one big moment.** The family home header, the hub overview headline and the AI suggestion card use the near-black surface.

## Tokens

Paste `design/tokens.css` into `src/app/globals.css`. Components use the token names, never the hex values.

### Color

| Token | Value | Use |
|---|---|---|
| `primary` | #0052FF | Primary buttons, links, current step, focus ring |
| `primary-active` | #003ECC | Pressed primary |
| `primary-disabled` | #A8B8CC | Disabled primary |
| `primary-soft` | #EBF0FF | Mic halo, update icon plate |
| `canvas` | #FFFFFF | Page background |
| `surface-soft` | #F7F7F7 | Soft panels, transcript boxes, hub status block |
| `surface-strong` | #EEF0F3 | Secondary buttons, chips, pills, icon plates, search |
| `surface-dark` | #0A0B0D | Dark hero, selected chip, AI suggestion card |
| `surface-dark-elevated` | #16181C | Pills and inputs on dark |
| `hairline` | #DEE1E6 | Input borders, card borders, column dividers |
| `hairline-soft` | #EEF0F3 | List dividers |
| `ink` | #0A0B0D | Headings and primary text |
| `body` | #5B616E | Secondary text |
| `muted` | #7C828A | Table headers, captions |
| `muted-soft` | #A8ACB3 | Upcoming steps, text on dark |
| `danger` | #CF202F | Totally damaged, urgent, hurt and missing. Text and dots only |
| `success` | #05B169 | Matches, GPS saved. Text and dots only |
| `warning` | #F4B000 | Partially damaged, needs attention. Dots only, never text |

### Map colors

A familiar street map palette, so people read the town at a glance: green land, blue water, gray built-up areas.

| Token | Value | Use |
|---|---|---|
| `map-land` | #CEF5DC | Natural land and vegetation |
| `map-urban` | #F2F0F0 | Built-up areas |
| `map-park` | #A0E5B9 | Parks, cemeteries, sports grounds |
| `map-sea` | #83D5EA | Sea |
| `map-river` | #83D5EA | Rivers and lakes |
| `map-road` | #7E9BB6 | Main roads, no casing |
| `map-road-minor` | #C7D3DD | Streets and paths |
| `map-boundary` | #B4B9C1, dashed | Barangay lines |
| `map-shade-1` to `map-shade-3` | #F6CFD2, #FAE2E4, #FDF1F2 for most to least totally damaged | Drawn under roads and labels, so shaded barangays keep their streets |

Place labels use `body`. Pins keep a 2px `canvas` ring so blue relief dots stay clear on water.

Pins: totally damaged is a `danger` dot, partially is a `warning` dot, not visited is a white dot with a dashed ink border, relief points are `primary` dots, shelters are `body` rounded squares, hazards are ink triangles, "you" is a `primary` dot with a soft halo.

### Type

Fonts load through `next/font/google`, which self-hosts them at build time. Never link Google Fonts in HTML.

- Sans: Inter 400, 500, 600, 700
- Mono: JetBrains Mono 500

| Token | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-xl` | 56 / 1.05 | 400 | -1.4px | Hub overview headline |
| `display-lg` | 40 / 1.1 | 400 | -1px | Hub page heroes, lock screen |
| `display-md` | 32 / 1.13 | 400 | -0.6px | Hub detail titles |
| `title-page` | 30 / 1.13 | 400 | -0.6px | Phone page headings |
| `title-bar` | 22 / 1.3 | 600 | -0.2px | Hub top bar title |
| `title-md` | 18 / 1.33 | 600 | 0 | Section headings |
| `title-sm` | 16 / 1.25 | 600 | 0 | Top bar titles on phones, list labels |
| `body-md` | 16 / 1.5 | 400 or 500 | 0 | Body, list values |
| `body-sm` | 14 / 1.5 | 400 | 0 | Secondary lines |
| `caption` | 13 / 1.5 | 500 | 0 | Table headers, small labels |
| `caption-strong` | 12 / 1.5 | 600 | 0 | Pills, tab labels |
| `mono-xl` | 64 / 1 | 500 | 0 | Recording timer |
| `mono-lg` | 44 / 1.1 | 500 | 0.16em | Report codes |
| `mono-md` | 26 to 36 | 500 | 0 | Stats |
| `mono-sm` | 12 to 14 | 500 | 0 | Times, distances, table numbers |
| `mono-xs` | 12 / 1.5 | 500 | 0 | Hub times |

### Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 8px | Tiny swatches |
| `radius-md` | 12px | Inputs |
| `radius-lg` | 16px | Hub cards, soft panels, photo tiles |
| `radius-xl` | 24px | Dark hero, phone feature cards, sheets |
| `radius-pill` | 100px | Buttons, chips, pills, search, segmented controls |
| `radius-full` | 9999px | Icon plates, avatars, mic button |

### Spacing

Base 4px. Phone screens use 20px side padding and 28px between sections. Hub pages use 32px side padding and 36px between sections. List rows are at least 64px tall on phones.

### Elevation

One shadow only, `0 4px 12px rgba(0,0,0,.08)`, for floating map buttons, the map legend and nothing else. Sheets sit on a 50% ink scrim with no shadow.

## Components

Build these once in `src/components/ui` during the foundation phase. Feature code composes them.

| Component | Spec | Seen on |
|---|---|---|
| `Button` | Pill. `primary` blue with white text, `secondary` surface-strong with ink text, `tertiary` blue text with no fill, `outline-dark` transparent with a white 1px border on dark. Height 56 on phones, 40 on the hub | Every screen |
| `TopBar` | Phone. 56px grid with back or close on the left, centered 16/600 title, optional right slot | Report flow, detail screens |
| `AppTopBar` | Phone. Search pill plus avatar circle | Responder lists |
| `ProgressSteps` | 4px pill track with a blue fill to step/4, then four labels in one row: Household, Details, Check, Send. Current label ink 600, done labels body, upcoming muted-soft | Family report flow |
| `Row` | Flat list row, min 64px, optional icon plate, label over value, optional trailing chevron or status | Lists everywhere |
| `IconPlate` | 40px circle, surface-strong, ink icon | Rows |
| `Pill` | 26px pill, surface-strong, 12/600 ink text, optional leading dot | Status, tags |
| `StatusDot` | 7px dot in danger, warning, success, primary or muted-soft | Damage classes, urgency |
| `Chip` | 44px pill toggle. Off surface-strong ink, on surface-dark white | Needs, filters, hazards |
| `Segmented` | Pill track in surface-strong with dark selected segment | Hub tabs and filters |
| `Counter` | Label left, 44px round minus and plus buttons, mono number | People, hurt, missing |
| `Input`, `Select`, `Textarea` | 52px on phones, 44 on the hub, 12px radius, hairline border, 2px primary border on focus | Forms |
| `Sheet` | Bottom sheet with 24px top corners, a handle, a title row with a close button | Edit, transcript, can't assess |
| `Timeline` | 20px markers: done is an ink circle with a white check, current is a primary ring, upcoming is a hairline ring. Times on the right in body color | Status, report sent, entry history |
| `DarkHero` | surface-dark panel with radius-xl, white display text, muted-soft secondary text | Home, overview, AI suggestion |
| `TabBar` | Responder bottom tabs: To visit, Map, Done, Queue. Active primary, others muted | Responder |
| `HubShell` | Left sidebar 240px with pill nav items, active surface-strong with primary text, offline status block, lock link. Top bar 72px with title, Simulation pill, search pill and avatar. Optional right rail 320px with a hairline left border | All hub pages |
| `MapView` | MapLibre with local PMTiles, legend card top left, zoom buttons bottom right | Family, responder and hub maps |

## Copy rules

- Sentence case everywhere. No all caps.
- One or two words for labels, one short line for anything else.
- No em dashes, en dashes or exclamation marks.
- Buttons say what happens: "Report my household", "Agree and send", "Confirm entry".
- Times as "2:48 PM", ranges as "3 to 5 PM".

## Accessibility

- Text contrast at least 4.5:1. `warning` yellow is never used for text.
- Touch targets at least 44px.
- Every icon-only button has an `aria-label`.
- Radio groups use real radio inputs. Toggle chips use `aria-pressed`.
- Respect `prefers-reduced-motion` for the recording waveform and spinners.
