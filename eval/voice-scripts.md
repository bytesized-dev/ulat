# Voice note scripts

Two scripts for the first audio check on BYT-5. Read each one in your own natural voice, about 20 seconds, on a phone. Say the name and the numbers clearly as written. You can change any other word to sound natural, but keep the facts the same, because `voice.csv` holds the expected fields.

Record in a noisy room, as `README.md` asks. A quiet take is a useful extra if you have time.

Save the recordings as `eval/voice/bisaya-01` and `eval/voice/tagalog-01`, any phone format, then convert each to 16 kHz mono WAV:

```
ffmpeg -i bisaya-01.m4a -ar 16000 -ac 1 bisaya-01.wav
ffmpeg -i tagalog-01.m4a -ar 16000 -ac 1 tagalog-01.wav
```

The scripts were drafted by an AI. A native speaker should check the wording before it counts as a language test.

## Bisaya (`bisaya-01`)

> Maayong gabii. Ako si Ramon Dela Cruz, taga Purok Tres. Lima mi sa balay. Duha ang nasamdan, si Nanay ug ang akong anak nga lalaki. Usa ang nawawala, ang akong igsoon nga si Jun, wala pa mi kabalo kung asa siya. Nawala ang atop sa among balay ug natumba ang usa ka bungbong. Nanginahanglan mi og tubig, pagkaon, ug tarpaulin.

Expected: household head Ramon Dela Cruz, 5 people, 2 hurt, 1 missing, roof gone and one wall fell, needs water, food and tarp.

## Tagalog (`tagalog-01`)

> Magandang gabi po. Ako po si Liza Santos, nasa Barangay San Isidro. Anim po kami sa bahay. Isa po ang nasugatan, ang tatay ko. Dalawa po ang hindi pa namin makita, ang mga pamangkin ko. Nawala po ang bubong namin at bumagsak ang likod na pader. Kailangan po namin ng tubig, gamot, at gamit para sa sanggol.

Expected: household head Liza Santos, 6 people, 1 hurt, 2 missing, roof gone and back wall fell, needs water, medicine and baby needs.
