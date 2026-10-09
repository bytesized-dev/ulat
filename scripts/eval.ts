import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { draftPhoto, readVoice } from "../src/lib/ai";
import { OLLAMA_MODEL, ollamaUrl } from "../src/lib/ai/config";
import { runEval } from "../src/lib/eval/run";
import { readBattery } from "../src/lib/status/probes";

// pnpm eval. Runs the photos in eval/labels.csv and the notes in
// eval/voice.csv through the real model and writes eval/results.json, which
// the AI check page reads. Docs: eval/README.md, docs/SPEC.md section 11.
// Unplug the hub first if you want the battery number.

async function main() {
  if (process.env.MOCK_AI === "1") {
    console.error("pnpm eval needs the real model. MOCK_AI=1 returns fixtures, so the numbers would mean nothing. Unset MOCK_AI and start Ollama.");
    process.exit(1);
  }
  const dir = resolve("eval");
  console.log(`Model ${OLLAMA_MODEL} at ${ollamaUrl()}`);

  const results = await runEval({
    dir,
    model: OLLAMA_MODEL,
    deps: { draftPhoto, readVoice, readBattery, clock: () => performance.now(), log: console.log },
  });

  // Write to a temp file and rename, so a crash never leaves half a results file.
  const target = resolve(dir, "results.json");
  const temp = `${target}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temp, `${JSON.stringify(results, null, 2)}\n`);
  await rename(temp, target);

  const { photos, voice, counts, battery } = results;
  console.log(`Wrote ${target}`);
  console.log(`Photos: ${counts.photos.run} run, ${counts.photos.scored} scored, ${counts.skipped} skipped in all. Agreement ${photos.agreement.rate ?? "n/a"}, AI accuracy ${photos.accuracy.rate ?? "n/a"}.`);
  console.log(`Voice: ${counts.voice.run} run of ${counts.voice.listed} listed. Seconds per note ${voice.seconds.mean ?? "n/a"}.`);
  console.log(`Battery per 100 houses: ${battery.percent_per_100_houses ?? "n/a"}${battery.reason ? ` (${battery.reason})` : ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
