import type { z } from "zod";
import { AiPhotoDraft, AiTranslation, AiVoiceExtract } from "../contracts";
import { hasSpeech, toWav } from "./audio";
import { logAiCall } from "./audit";
import { chatJson, OllamaError, type ChatJsonInput } from "./ollama";
import { PHOTO_SYSTEM, photoUserPrompt, TRANSLATE_SYSTEM, VOICE_SYSTEM } from "./prompts";
import { findMissingFacts } from "./translate-check";

// Every AI call goes through these three functions. Voice, photo and
// translation call Ollama through ./ollama and parse the model's output with
// the contract schemas before they return.

/** Call the model once, write the raw reply to the audit trail, and pass failures on. */
async function callOnce<S extends z.ZodType>(call: "voice", request: ChatJsonInput<S>): Promise<z.infer<S>> {
  try {
    const { value, raw } = await chatJson(request);
    await logAiCall(call, { raw });
    return value;
  } catch (error) {
    if (error instanceof OllamaError) await logAiCall(call, { raw: error.raw, error });
    throw error;
  }
}

/**
 * Without structured output, Gemma now and then breaks the JSON or writes null
 * where the schema wants text, and the family would have to record again. The
 * first try runs at temperature 0, which failed none of 16 test notes against
 * 2 of 16 at the default. A reply that still fails is logged and asked once
 * more at the default temperature, which gives a different reply.
 */
async function extract<S extends z.ZodType>(
  call: "voice",
  schema: S,
  request: Omit<ChatJsonInput<S>, "schema">,
): Promise<z.infer<S>> {
  try {
    return await callOnce(call, { ...request, schema, options: { temperature: 0 } });
  } catch (error) {
    if (!(error instanceof OllamaError) || error.kind !== "invalid_output") throw error;
    return callOnce(call, { ...request, schema });
  }
}

/**
 * A voice note, up to 30 seconds. The audio goes to Gemma natively, which is
 * the provisional BYT-5 decision. If that fails the risk check, whisper.cpp
 * transcribes first and this sends the transcript as text instead. Ollama
 * reads only WAV, so the recording is converted first, see ./audio.
 */
export async function readVoice(input: { audio: Buffer; mime: string }): Promise<AiVoiceExtract> {
  let wav: Buffer;
  try {
    wav = await toWav(input.audio);
    // Gemma answers a silent note with a made-up report, so it never sees one.
    // rejected is final: the same recording will not gain speech on a retry.
    if (!hasSpeech(wav)) throw new OllamaError("rejected", "No speech in the recording");
  } catch (error) {
    if (error instanceof OllamaError) await logAiCall("voice", { raw: error.raw, error });
    throw error;
  }
  return extract("voice", AiVoiceExtract, { system: VOICE_SYSTEM, user: "Read this voice note.", media: [wav] });
}

type PhotoInput = {
  photos: { data: Buffer; mime: string; label: string }[];
};

/**
 * draftPhoto, plus the model's raw reply for the audit trail. On a failed call
 * the OllamaError carries the raw reply.
 */
export async function draftPhotoWithRaw(input: PhotoInput): Promise<{ draft: AiPhotoDraft; raw: string }> {
  const { value, raw } = await chatJson({
    schema: AiPhotoDraft,
    system: PHOTO_SYSTEM,
    user: photoUserPrompt({ labels: input.photos.map((photo, i) => photo.label || `Photo ${i + 1}`) }),
    media: input.photos.map((photo) => photo.data),
    // The same photos should give the same class every time.
    options: { temperature: 0 },
  });
  return { draft: value, raw };
}

/** The photo a family sent with their report. The hub reads it in the background, see ./draft-report. */
export async function draftPhoto(input: PhotoInput): Promise<AiPhotoDraft> {
  return (await draftPhotoWithRaw(input)).draft;
}

/**
 * An English headline and message to Bisaya and Tagalog drafts. Every time,
 * number and place name in the English has to appear in both drafts as written.
 * If one does not, this throws invalid_output and staff type the translation.
 */
export async function translate(input: { headline: string; message: string }): Promise<AiTranslation> {
  try {
    const { value, raw } = await chatJson({
      schema: AiTranslation,
      system: TRANSLATE_SYSTEM,
      user: `Headline: ${input.headline}\nMessage: ${input.message}`,
    });
    const missing = findMissingFacts(input, value);
    if (missing.length) {
      const list = missing.map((fact) => `${fact.language} ${fact.kind} "${fact.text}"`).join(", ");
      throw new OllamaError("invalid_output", `The draft changed or dropped: ${list}`, raw);
    }
    await logAiCall("translate", { raw });
    return value;
  } catch (error) {
    if (error instanceof OllamaError) await logAiCall("translate", { raw: error.raw, error });
    throw error;
  }
}
