# Ulat brief

**Design canvas:** https://claude.ai/artifact/DazFfmDpKxWhyxodNk9KwH

## In one line

A field kit, one laptop and one router with no internet, that turns photos and voice notes into the damage report an LGU has to file within 72 hours.

## The problem

After a typhoon, flood or earthquake, every LGU runs a Rapid Damage Assessment and Needs Analysis, or RDANA. It is the first count of who got hit and what they need, and it decides where relief goes first. Davao City, for example, requires its RDANA report within 24 to 72 hours of the disaster.

That window is exactly when the network is gone.

- Two days after Typhoon Odette, entire provinces still had no power or cellphone service, and Dinagat Islands officials were still cut off.
- In Albay after Typhoon Nina, the MDRRMO could not finalize how many families were affected because some villages had no working communications.
- In Batanes after Typhoon Ferdie, the OCD regional chief said losing communication lines was paralyzing their response planning.
- After Odette, OCHA noted that the initial assessment reports underestimated the damage.

The damage class has money attached. DSWD defines a partially damaged house as still livable with reusable materials, and a totally damaged house as destroyed and unfit to live in. Shelter assistance differs by class, and photos of the house are part of the documents. So every classification needs a human to confirm it and a record of who did.

Hook for the pitch: on 10 October 2025, a magnitude 7.4 earthquake hit eastern Mindanao. If demo day is 10 October 2026, it is exactly one year later.

## Who uses it

| User | Device | What they do |
|---|---|---|
| Families at the evacuation center | Their own phone, or the help desk | Report their household with a short form and a photo, check their report by code, find water and shelters, tell relatives they are safe |
| MDRRMO responders in the field | Their phone | Get a to-visit list sorted by urgency, photograph each house and confirm it on one screen that starts from the family's report and the hub's reading of their photo |
| MDRRMO staff at the hub | The laptop | Watch the totals, review disagreements, assign reports, post updates, print the situation report, send the SMS summary |

## The rule that holds it together

**Families report, responders verify, and only verified entries count.**

Family reports tell responders where to go first. They never change the totals. A responder's confirmed entry is what counts toward the report and toward shelter assistance. This keeps exaggeration and double reporting out of the numbers.

## Why local AI

Half the judging score is usefulness and how real the local AI is. These are the reasons the cloud version fails.

1. **No network.** The tool exists for the 72 hours when there isn't one.
2. **No power.** The hub runs on laptop battery. Measure assessments per charge and put the number in the pitch.
3. **Bandwidth.** Even with one bar of signal, hundreds of photos cannot upload. The hub turns them into a few kilobytes of structured data, and the SMS summary fits in two texts.
4. **Sensitive data.** The database maps where injured people and vulnerable families are. It stays on a laptop the MDRRMO holds.

Line for the pitch: everything that needs internet happens before the storm. The map, the model and the certificate are all downloaded in advance.

## What the AI does

- **Voice to form.** A note recorded at the help desk in Bisaya, Tagalog, Taglish or English becomes household head, people, hurt, missing, damage and needs. The hub also translates it to English for responders. Families fill the form themselves on their phones.
- **Family photo reading.** The hub reads the photo a family sends with its report: damage class, hazards and a one-line reason. Code turns that and the hurt and missing counts into an urgency label for responders and staff, who can set their own verdict.
- **Photo to damage class.** The photo a family sends with a report becomes a suggested class (none, partial, total or unclear) with a one-line reason, using the DSWD definitions. The hub reads it in the background, and code turns it into an urgency. Responder photos are evidence only and never go to the AI.
- **Translation of updates.** Staff write an update in English and the hub drafts Bisaya and Tagalog versions for staff to check.

The model never counts. Code computes every total from confirmed entries.

## Hackathon facts

- Theme: Local AI. Inference must run on a laptop, phone or edge device. Cloud is allowed only as a secondary component.
- Submission: project name, description, team members, public GitHub repo, a video of about one minute, and disclosures of all models and tools. Submit on Cerebral Valley before 10:00 AM sharp. No edits after.
- The video must be posted on X or LinkedIn tagging Cognition with #AppBuildersPH.
- Judging: half on usefulness and how real the local AI is, the rest on execution, innovation and product or demo quality.
- Finalists pitch for 5 minutes with 3 minutes of Q&A. Someone must be on site at CyberZone SM Makati. Confirm the demo day date in the Telegram group.
- Team members must be on the official list. Prior code is allowed if disclosed. A live link is a bonus but not required if the repo explains how to run it.

## Demo script

**Video, 60 seconds**

1. 0 to 8 s: "After Typhoon Odette, whole provinces had no signal for days. That's when LGUs have to count the damage."
2. 8 to 15 s: the router with nothing in its internet port, and a phone saying there's no internet.
3. 15 to 45 s: a family sends a report with a photo and a hollow pin appears on the hub map. The hub reads the photo as "Totally damaged" with high urgency. A responder opens it, photographs the house, and confirms on one screen with the class already picked. The pin turns red, and the family sees "Totally damaged" under their code.
4. 45 to 55 s: the situation report and SMS summary, then the eval numbers.
5. 55 to 60 s: "Ulat. One laptop, one router, no internet."

**Pitch, 5 minutes:** a minute on the problem, two minutes of live demo with the network visibly off, 30 seconds on why local, 30 seconds on eval numbers including where the model is weak, and a minute on who pays and what's next.

## Answers for Q&A

- **What if the model is wrong?** It only drafts. A person confirms every entry, the reason is shown, and overrides are tracked.
- **Won't families exaggerate?** Family reports never count toward totals. They only set the order of visits.
- **Families without phones?** The help desk enters reports for them, neighbors can report for them, and responders still canvass.
- **Why not satellite imagery?** It sees roofs, is blocked by cloud cover after typhoons, can't count families or injuries, and needs the internet you don't have.
- **Why not run it on the phone?** Field phones are mostly budget Androids. One hub serves many phones that only need a browser.
- **KoBoToolbox and ODK already work offline.** They give you an empty form offline. Ulat fills the form from a photo and a voice note, then totals it and drafts the report on site.
- **Who pays?** LGUs. Under RA 10121, at least 5% of an LGU's estimated regular revenue goes to the LDRRMF, which covers preparedness, training and equipment.
- **Bisaya?** Say exactly what the eval showed, and point to typing and the help desk as fallbacks.

## After the hackathon

LGUs already run RDANA trainings with simulation exercises, for example Hingyon's MDRRMO in May 2026. Those drills are where a pilot happens, starting with the team's own town.

## Sources

- Davao City RDANA team and the 24 to 72 hour report: https://davaocity.gov.ph/local-government/davao-city-govt-forms-body-for-disaster-assessment-response/
- Odette, provinces without power and signal: https://www.thedailystar.net/environment/climate-crisis/natural-disaster/news/philippines-typhoon-leaves-19-dead-many-homes-roofless-2920231
- Albay after Nina: https://newsinfo.inquirer.net/856752/telco-services-in-some-albay-towns-still-down/amp
- Batanes after Ferdie: https://www.rappler.com/?p=146167
- OCHA on Odette assessments: https://reliefweb.int/report/philippines/philippines-consolidated-needs-assessment-report-revision-super-typhoon-rai
- DSWD damage definitions: https://batasnatin.com/laws/mc-mc-2020-032-1
- Eastern Mindanao earthquakes RDANA: https://reliefweb.int/report/philippines/wfp-rapid-damage-assessment-and-needs-analysis-rdana-magnitude-mw-74-and-68-earthquakes-eastern-mindanao-philippines-10-october-2025
- LDRRMF 5%: https://preparecenter.org/resource/local-disaster-risk-reduction-and-management-fund-ldrrmf/
- Hingyon RDANA training: https://hingyon.gov.ph/rdana-training-strengthens-local-disaster-response-capacity/
