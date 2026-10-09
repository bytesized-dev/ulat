import { AiPhotoDraft, AiTranslation, AiVoiceExtract } from "../contracts";
import fixtureFile from "../../../seed/ai-fixtures.json";
import { logAiCall } from "./audit";
import { chatJson, OllamaError, type ChatJsonInput } from "./ollama";
import { PHOTO_SYSTEM, photoUserPrompt, TEXT_SYSTEM, VOICE_SYSTEM } from "./prompts";

// Every AI call goes through these four functions. With MOCK_AI=1 they return
// the fixtures in seed/ai-fixtures.json. Voice, text and photo call Ollama
// through ./ollama. The translation call (BYT-57) lands later and keeps its
// signature. The real calls parse the model's output with the same
// schemas before they return.

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

/** Call the model, write the raw reply to the audit trail, and pass failures on. */
async function extract(call: "voice" | "text", request: Omit<ChatJsonInput<typeof AiVoiceExtract>, "schema">) {
  try {
    const { value, raw } = await chatJson({ ...request, schema: AiVoiceExtract });
    await logAiCall(call, { raw });
    return value;
  } catch (error) {
    if (error instanceof OllamaError) await logAiCall(call, { raw: error.raw, error });
    throw error;
  }
}

/**
 * A voice note, up to 30 seconds. The audio goes to Gemma natively, which is
 * the provisional BYT-5 decision. If that fails the risk check, whisper.cpp
 * transcribes first and this sends the transcript as text instead.
 */
export async function readVoice(input: { audio: Buffer; mime: string }): Promise<AiVoiceExtract> {
  if (isMock()) return structuredClone(fixtures.voice);
  return extract("voice", { system: VOICE_SYSTEM, user: "Read this voice note.", media: [input.audio] });
}

/** A typed note. The transcript comes back empty. */
export async function readText(input: { text: string }): Promise<AiVoiceExtract> {
  if (isMock()) return structuredClone(fixtures.text);
  const value = await extract("text", { system: TEXT_SYSTEM, user: input.text });
  return { ...value, transcript: "" };
}

type PhotoInput = {
  photos: { data: Buffer; mime: string; label: string }[];
  note?: string | null;
};

/**
 * draftPhoto, plus the model's raw reply for the audit trail. The raw text is
 * null under MOCK_AI. On a failed call the OllamaError carries the raw reply.
 */
export async function draftPhotoWithRaw(input: PhotoInput): Promise<{ draft: AiPhotoDraft; raw: string | null }> {
  if (isMock()) {
    return { draft: structuredClone(input.photos.length === 1 ? fixtures.photoUnclear : fixtures.photo), raw: null };
  }
  const { value, raw } = await chatJson({
    schema: AiPhotoDraft,
    system: PHOTO_SYSTEM,
    user: photoUserPrompt({ labels: input.photos.map((photo, i) => photo.label || `Photo ${i + 1}`), note: input.note }),
    media: input.photos.map((photo) => photo.data),
    // The same photos should give the same class every time.
    options: { temperature: 0 },
  });
  return { draft: value, raw };
}

/** One to three photos of one house, with the responder's note if there is one. */
export async function draftPhoto(input: PhotoInput): Promise<AiPhotoDraft> {
  return (await draftPhotoWithRaw(input)).draft;
}

/** An English headline and message to Bisaya and Tagalog drafts. */
export async function translate(input: { headline: string; message: string }): Promise<AiTranslation> {
  void input;
  if (isMock()) return structuredClone(fixtures.translation);
  return notWired("translate", "BYT-57");
}
