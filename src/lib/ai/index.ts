import { AiPhotoDraft, AiTranslation, AiVoiceExtract } from "../contracts";
import fixtureFile from "../../../seed/ai-fixtures.json";

// Every AI call goes through these four functions. With MOCK_AI=1 they return
// the fixtures in seed/ai-fixtures.json. The Ollama calls land in BYT-9 (voice
// and text), BYT-25 (photos) and BYT-57 (translation), and keep these
// signatures. The real calls parse the model's output with the same schemas
// before they return.

// Parsed when the module loads, so a broken fixture fails loudly.
const fixtures = {
  voice: AiVoiceExtract.parse(fixtureFile.voice),
  text: AiVoiceExtract.parse(fixtureFile.text),
  photo: AiPhotoDraft.parse(fixtureFile.photo),
  photoUnclear: AiPhotoDraft.parse(fixtureFile.photo_unclear),
  translation: AiTranslation.parse(fixtureFile.translation),
};

const isMock = () => process.env.MOCK_AI === "1";

function notWired(call: string, issue: string): never {
  throw new Error(`${call} needs Ollama. Set MOCK_AI=1 to use fixtures. The Ollama call lands in ${issue}.`);
}

/** A voice note, up to 30 seconds. */
export async function readVoice(input: { audio: Buffer; mime: string }): Promise<AiVoiceExtract> {
  void input;
  if (isMock()) return structuredClone(fixtures.voice);
  return notWired("readVoice", "BYT-9");
}

/** A typed note. The transcript comes back empty. */
export async function readText(input: { text: string }): Promise<AiVoiceExtract> {
  void input;
  if (isMock()) return structuredClone(fixtures.text);
  return notWired("readText", "BYT-9");
}

/** One to three photos of one house, with the responder's note if there is one. */
export async function draftPhoto(input: {
  photos: { data: Buffer; mime: string; label: string }[];
  note?: string | null;
}): Promise<AiPhotoDraft> {
  if (isMock()) return structuredClone(input.photos.length === 1 ? fixtures.photoUnclear : fixtures.photo);
  return notWired("draftPhoto", "BYT-25");
}

/** An English headline and message to Bisaya and Tagalog drafts. */
export async function translate(input: { headline: string; message: string }): Promise<AiTranslation> {
  void input;
  if (isMock()) return structuredClone(fixtures.translation);
  return notWired("translate", "BYT-57");
}
