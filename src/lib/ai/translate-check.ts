import type { AiTranslation } from "../contracts";

// The model reads and translates, the code checks. Times, numbers and place
// names in an update must reach the Bisaya and Tagalog drafts exactly as staff
// wrote them, because families act on them. This pulls those facts out of the
// English and looks for each one in both drafts. A fact that is missing means
// the draft cannot be trusted, and staff type the translation themselves.

export type FactKind = "time" | "number" | "place";
export type Fact = { kind: FactKind; text: string };
export type MissingFact = Fact & { language: "ceb" | "tl" };

// 3:00 PM, 15:00, 3 PM, 5 a.m.
const TIME = /\b\d{1,2}:\d{2}(?:\s?(?:[ap]\.m\.|[ap]m\b))?|\b\d{1,2}\s?(?:[ap]\.m\.|[ap]m\b)/giu;
// 5, 1,200, 2.5
const NUMBER = /\d+(?:[.,]\d+)*/g;

// Capitalized words that are not part of a place.
// Dates are left out because Bisaya and Tagalog write them in their own words.
const NOT_PLACES = new Set(
  (
    "a an the and or but at in on of for to by from with near is are be will can no not all please this that these those " +
    "monday tuesday wednesday thursday friday saturday sunday " +
    "january february march april may june july august september october november december"
  ).split(" "),
);

// A period after these does not end a sentence, so "Sto. Niño" stays one name.
const ABBREVIATIONS = new Set(["sto", "sta", "st", "brgy", "mt", "dr", "mr", "ms", "mrs", "gen", "jr", "sr", "no"]);

const isCapitalized = (word: string) => /^\p{Lu}\p{Ll}/u.test(word);

type Word = { text: string; startsSentence: boolean; endsRun: boolean };

function wordsOf(text: string): Word[] {
  const words: Word[] = [];
  let startsSentence = true;
  for (const token of text.match(/\S+/gu) ?? []) {
    const core = token.replace(/^[("'“‘[]+/u, "").replace(/[,;:)"'”’\]]+$/u, "");
    const endsSentence = /[.!?]$/u.test(core) && !ABBREVIATIONS.has(core.replace(/[.!?]+$/u, "").toLowerCase());
    words.push({
      text: endsSentence ? core.replace(/[.!?]+$/u, "") : core,
      startsSentence,
      endsRun: endsSentence || core !== token.replace(/^[("'“‘[]+/u, ""),
    });
    startsSentence = endsSentence;
  }
  return words;
}

/**
 * Runs of capitalized words, like "Plaza" or "Sto. Niño Gym". The first word of
 * a sentence is skipped because every sentence starts with a capital. Headlines
 * are sentence case in Ulat, so a Title Case headline will report its content
 * words as places and fail the check, which is the safe way to be wrong.
 */
function placesIn(text: string): string[] {
  const places: string[] = [];
  let run: string[] = [];
  const close = () => {
    if (run.length) places.push(run.join(" "));
    run = [];
  };
  for (const word of wordsOf(text)) {
    const isPlaceWord = isCapitalized(word.text) && !NOT_PLACES.has(word.text.toLowerCase()) && !word.startsSentence;
    if (isPlaceWord) run.push(word.text);
    else close();
    if (word.endsRun) close();
  }
  close();
  return places;
}

/** Every time, number and place name the drafts have to keep, in the order they appear. */
export function extractFacts(english: { headline: string; message: string }): Fact[] {
  const facts: Fact[] = [];
  for (const text of [english.headline, english.message]) {
    const times = text.match(TIME) ?? [];
    const rest = text.replace(TIME, " ");
    facts.push(
      ...times.map((time) => ({ kind: "time" as const, text: time })),
      ...(rest.match(NUMBER) ?? []).map((number) => ({ kind: "number" as const, text: number })),
      ...placesIn(rest).map((place) => ({ kind: "place" as const, text: place })),
    );
  }
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.kind}:${fact.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The fact written exactly as is, not inside a longer number or word. Case and spacing are ignored. */
function appearsIn(fact: Fact, draft: string): boolean {
  const pattern = escape(fact.text.trim()).replace(/\s+/g, "\\s*");
  const edges =
    fact.kind === "place"
      ? [String.raw`(?<![\p{L}\p{N}])`, String.raw`(?![\p{L}\p{N}])`]
      : [String.raw`(?<!\d)(?<!\d[.,:])`, String.raw`(?!\d)(?![.,:]\d)`];
  return new RegExp(`${edges[0]}${pattern}${edges[1]}`, "iu").test(draft);
}

/** The facts from the English that one or both drafts dropped or changed. Empty means the drafts are safe to show. */
export function findMissingFacts(english: { headline: string; message: string }, draft: AiTranslation): MissingFact[] {
  const facts = extractFacts(english);
  return (["ceb", "tl"] as const).flatMap((language) =>
    facts.filter((fact) => !appearsIn(fact, draft[language])).map((fact) => ({ ...fact, language })),
  );
}
