# Voice note scripts

12 notes for `eval/voice`. Each row matches `eval/voice.csv`. The facts in the expected fields are the ground truth, so say every one of them: head of household, people, hurt, missing and needs.

## How to record

- Use a phone voice recorder and save as `v01` to `v12` (any phone format, then convert to 16 kHz mono WAV like voice-scripts.md says) in `eval/voice`.
- Each note runs 15 to 30 seconds. Speak at a normal pace, like a family member would.
- Record in a noisy room (fan, TV, street, people talking). Clean audio would flatter the model.
- Read the script naturally. Small wording changes are fine, but keep the numbers and the needs.
- Ideally use more than one voice. A teammate or family member can read some of them.
- The Bisaya (ceb) and Tagalog (tl) lines were drafted by an AI. Have a native speaker fix any stiff wording before recording. Keep the facts the same.
- Language codes in `voice.csv` follow the app contract: `ceb` is Bisaya, `tl` is Tagalog, `mixed` is Taglish, `en` is English.
- Needs can only be: water, food, tarp, medicine, hygiene_kit, baby_needs. Separate several with `;`.

## Bisaya (ceb)

**v01**: head Maria Santos, 5 people, 1 hurt, 0 missing, needs water and food
> Maayong adlaw. Ako si Maria Santos sa Purok 3. Lima mi sa balay. Nawala ang atop sa among balay. Usa ka bata ang samaran sa tiil. Wala mi tubig ug pagkaon.

**v02**: head Roberto Dela Cruz, 7 people, 0 hurt, 1 missing, needs tarp and water
> Ako si Roberto Dela Cruz. Pito mi tanan sa balay. Natumba ang among bungbong. Walay nasamdan, pero ang akong igsoon wala pa nakit-an. Kinahanglan mi og tarpolin ug tubig.

**v03**: head Ana Reyes, 4 people, 2 hurt, 0 missing, needs baby_needs and medicine
> Si Ana Reyes ni. Upat mi sa balay. Naanod ang among balay sa baha. Duha ang samaran. Naa pud mi gamayng bata, kinahanglan mi og gatas ug diaper, ug tambal.

## Tagalog (tl)

**v04**: head Josefina Ramos, 6 people, 0 hurt, 0 missing, needs water and food
> Magandang umaga po. Ako po si Josefina Ramos. Anim po kami sa bahay. Natangay po ang bubong namin. Walang nasaktan at walang nawawala. Kailangan po namin ng tubig at pagkain.

**v05**: head Eduardo Villanueva, 4 people, 1 hurt, 0 missing, needs medicine
> Si Eduardo Villanueva po ito. Apat po kami. Gumuho po ang pader at nasugatan ang asawa ko sa braso. Walang nawawala. Kailangan po namin ng gamot.

**v06**: head Carmela Bautista, 8 people, 0 hurt, 2 missing, needs tarp and hygiene_kit
> Ako si Carmela Bautista, walong tao po kami dito. Binaha po hanggang bubong. Walang nasaktan, pero dalawa po ang nawawala, yung dalawang pamangkin ko. Kailangan po namin ng tarpaulin at hygiene kit.

## Taglish (mixed)

**v07**: head Mark Anthony Flores, 5 people, 1 hurt, 0 missing, needs water and medicine
> Hi po, si Mark Anthony Flores ito. We're five here sa bahay. Yung roof namin nawala, tapos may isang injured, yung lola ko. Walang missing. Need po namin ng water and medicine.

**v08**: head Grace Lim, 3 people, 0 hurt, 0 missing, needs tarp
> Ako po si Grace Lim, three kami sa bahay. Nasira yung wall pero okay naman kami, walang hurt, walang missing. Kailangan lang namin ng tarp.

**v09**: head Ramil Torres, 10 people, 0 hurt, 1 missing, needs baby_needs
> This is Ramil Torres, ten kami dito. May baby kami na seven months, need namin ng diaper and gatas. Walang hurt, pero isa yung nawawala, si kuya ko, hindi pa namin siya makita.

## English (en)

**v10**: head Patricia Gomez, 6 people, 2 hurt, 0 missing, needs water and food
> Hello, this is Patricia Gomez. There are six of us at home. The roof was blown off and two people are hurt, one with a cut leg. Nobody is missing. We need water and food.

**v11**: head Daniel Cruz, 4 people, 0 hurt, 1 missing, needs tarp and hygiene_kit
> My name is Daniel Cruz. We are four in the house. The flood took everything. Nobody is hurt, but my father has been missing since last night. We need a tarp and hygiene kits.

**v12**: head Liza Mendoza, 5 people, 0 hurt, 0 missing, no needs
> This is Liza Mendoza, five people. Our house is fine, only the fence fell. No one is hurt or missing. We don't need anything right now.

## After recording

Run `node scripts/check-eval.mjs`. It should report 12 voice files, 12 rows and 3 notes in each language.
