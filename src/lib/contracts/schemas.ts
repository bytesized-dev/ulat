/**
 * Shared contracts for Ulat. Owned by Platform. See docs/SPEC.md sections 3 to 5.
 * Every API body and every AI output is parsed with these schemas.
 */
import { z } from "zod";

export const REPORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ReportCode = z.string().regex(/^[A-HJ-NP-Z2-9]{4}$/);

export const DamageClass = z.enum(["none", "partial", "total", "unclear"]);
export const ConfirmedDamageClass = z.enum(["none", "partial", "total"]);
export const Confidence = z.enum(["low", "medium", "high"]);
export const Need = z.enum(["water", "food", "tarp", "medicine", "hygiene_kit", "baby_needs"]);
export const Material = z.enum(["light", "mixed", "concrete", "unknown"]);
export const Language = z.enum(["ceb", "tl", "en", "mixed", "unknown"]);
export const ReportSource = z.enum(["family", "neighbor", "desk"]);
export const ReportStatus = z.enum(["waiting", "assigned", "on_the_way", "visited", "cant_assess", "merged"]);
export const EntryStatus = z.enum(["draft", "needs_review", "confirmed"]);
export const CantAssessReason = z.enum(["cant_find", "no_one_home", "road_blocked", "not_safe", "other"]);
export const PlaceType = z.enum(["relief", "shelter", "hazard"]);
export const UpdateType = z.enum(["water_food", "shelter", "hazard", "notice"]);

const Count = z.number().int().min(0).max(99);
const ShortText = z.string().trim().min(1).max(120);
const LatLng = { lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable() };

/* ---------- AI outputs ---------- */

export const VoiceField = z.enum(["household_head", "people", "hurt", "missing", "what_happened", "needs"]);

export const AiVoiceExtract = z.object({
  language: Language,
  transcript: z.string().max(2000),
  english: z.string().max(2000),
  household_head: z.string().max(120).nullable(),
  people: Count.nullable(),
  hurt: Count.nullable(),
  missing: Count.nullable(),
  what_happened: z.string().max(200).nullable(),
  needs: z.array(Need),
  hazards: z.array(z.string().max(80)),
  uncertain_fields: z.array(VoiceField),
});
export type AiVoiceExtract = z.infer<typeof AiVoiceExtract>;

export const AiPhotoDraft = z.object({
  damage_class: DamageClass,
  confidence: Confidence,
  material: Material,
  hazards: z.array(z.string().max(80)),
  reason: z.string().max(240),
  need_more: z.string().max(120).nullable(),
});
export type AiPhotoDraft = z.infer<typeof AiPhotoDraft>;

export const AiTranslation = z.object({
  ceb: z.string().max(1000),
  tl: z.string().max(1000),
});
export type AiTranslation = z.infer<typeof AiTranslation>;

/**
 * What the AI routes send back when they cannot return an extract. Screens show
 * a retry button only when `retry` is true. `rejected` is Ollama refusing the
 * input with a 4xx, so the same request can never succeed.
 */
export const AiErrorBody = z.object({
  error: z.enum(["bad_request", "too_large", "rejected", "timeout", "unavailable", "invalid_output"]),
  retry: z.boolean(),
});
export type AiErrorBody = z.infer<typeof AiErrorBody>;

/* ---------- API inputs ---------- */

export const NewReport = z.object({
  source: ReportSource,
  household_head: ShortText,
  reporter_name: z.string().max(120).nullable(),
  reporter_where: z.string().max(120).nullable(),
  barangay: ShortText,
  purok: z.string().max(60).nullable(),
  ...LatLng,
  people: Count,
  hurt: Count,
  missing: Count,
  what_happened: z.string().max(200).nullable(),
  needs: z.array(Need),
  voice_id: z.string().uuid().nullable(),
  /** Names a photo sent to POST /api/reports/photo. A report queued before photos existed has no key, so a missing one reads as null. */
  photo_id: z.string().uuid().nullable().default(null),
  transcript: z.string().max(2000).nullable(),
  english: z.string().max(2000).nullable(),
  language: Language.nullable(),
  /** Made once on the phone when the family taps Send. The hub returns the same code for a repeat. */
  client_id: z.string().uuid().optional(),
  consent: z.literal(true),
});
// The input type, so a caller that builds a report by hand, such as the help
// desk form, need not name photo_id. Parsing always fills it in.
export type NewReport = z.input<typeof NewReport>;

/**
 * The fields next to the audio file in POST /api/reports/voice. The phone makes
 * the id, as it does the client_id, so sending the same recording twice stores
 * one file. NewReport.voice_id names it afterwards.
 */
export const NewVoiceMeta = z.object({ voice_id: z.string().uuid() });
export type NewVoiceMeta = z.infer<typeof NewVoiceMeta>;

/** The answer to a voice upload. No URL: only a responder or staff can read the audio, by report. */
export const VoiceStored = z.object({ voice_id: z.string().uuid() });
export type VoiceStored = z.infer<typeof VoiceStored>;

/**
 * The fields next to the image file in POST /api/reports/photo. The phone makes
 * the id, as it does the voice_id, so sending the same photo twice stores one
 * file. NewReport.photo_id names it afterwards.
 */
export const NewPhotoMeta = z.object({ photo_id: z.string().uuid() });
export type NewPhotoMeta = z.infer<typeof NewPhotoMeta>;

/** The answer to a photo upload. No URL: only a responder or staff can see the photo, by id through /api/files. */
export const PhotoStored = z.object({ photo_id: z.string().uuid() });
export type PhotoStored = z.infer<typeof PhotoStored>;

export const CantAssess = z.object({
  reason: CantAssessReason,
  note: z.string().max(240).nullable(),
});

export const AssignReport = z.object({ responder_id: z.string().uuid() });

export const NewEntryMeta = z.object({
  report_code: ReportCode.nullable(),
  barangay: ShortText,
  purok: z.string().max(60).nullable(),
  household_head: z.string().max(120).nullable(),
  ...LatLng,
  gps_accuracy_m: z.number().min(0).nullable(),
  photo_labels: z.array(z.string().max(40)).max(3),
  /** Made once on the phone when the responder taps Send. The hub returns the same entry for a repeat. */
  client_id: z.string().uuid().optional(),
});
export type NewEntryMeta = z.infer<typeof NewEntryMeta>;

export const EntryConfirm = z.object({
  damage_class: ConfirmedDamageClass,
  material: Material,
  hazards: z.array(z.string().max(80)),
  families: z.number().int().min(1).max(20),
  people: Count,
  hurt: Count,
  missing: Count,
  needs: z.array(Need),
  new_photo_since_unclear: z.boolean(),
});
export type EntryConfirm = z.infer<typeof EntryConfirm>;

export const NewUpdate = z.object({
  type: UpdateType,
  headline: ShortText,
  message: z.string().max(400),
  message_ceb: z.string().max(1000).nullable(),
  message_tl: z.string().max(1000).nullable(),
  place_id: z.string().uuid().nullable(),
});

export const NewPlace = z.object({
  type: PlaceType,
  name: ShortText,
  details: z.string().max(240).nullable(),
  when_text: z.string().max(80).nullable(),
  lat: z.number(),
  lng: z.number(),
  visible: z.boolean(),
  post_as_update: z.boolean(),
});

export const SafeCheckin = z.object({
  name: ShortText,
  barangay: ShortText,
  staying_at: ShortText,
  message: z.string().max(240).nullable(),
  source: z.enum(["phone", "desk"]),
});

const Pin = z.string().regex(/^\d{4,8}$/);

/** Trimmed and lower case, the way `responders.email` is stored. */
export const ResponderSignIn = z.object({
  email: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(200),
});
export type ResponderSignIn = z.infer<typeof ResponderSignIn>;

export const StaffSignIn = z.object({ pin: Pin });
export type StaffSignIn = z.infer<typeof StaffSignIn>;

/* ---------- API outputs ---------- */

export const StatusStep = z.enum(["received", "on_the_way", "visited", "confirmed"]);

/** What a family sees for their own code. Nothing else is exposed without a PIN. */
export const ReportStatusView = z.object({
  code: ReportCode,
  household_head: z.string(),
  barangay: z.string(),
  purok: z.string().nullable(),
  urgent: z.boolean(),
  steps: z.array(z.object({ step: StatusStep, at: z.string().nullable() })),
  result: ConfirmedDamageClass.nullable(),
  confirmed_by: z.string().nullable(),
});
export type ReportStatusView = z.infer<typeof ReportStatusView>;

export const Priority = z.enum(["high", "medium", "low"]);

export const BarangayRow = z.object({
  barangay: z.string(),
  totally: z.number().int(),
  partially: z.number().int(),
  none: z.number().int(),
  families: z.number().int(),
  people: z.number().int(),
  hurt: z.number().int(),
  missing: z.number().int(),
  waiting: z.number().int(),
  priority: Priority,
});
export type BarangayRow = z.infer<typeof BarangayRow>;

export const HubSummary = z.object({
  as_of: z.string(),
  houses_checked: z.number().int(),
  totally: z.number().int(),
  partially: z.number().int(),
  none: z.number().int(),
  families: z.number().int(),
  people: z.number().int(),
  hurt: z.number().int(),
  missing: z.number().int(),
  not_yet_visited: z.number().int(),
  in_review: z.number().int(),
  needs: z.record(Need, z.number().int()),
  barangays: z.array(BarangayRow),
});
export type HubSummary = z.infer<typeof HubSummary>;

export const HubStatus = z.object({
  internet: z.boolean(),
  phones: z.number().int(),
  battery_percent: z.number().int().min(0).max(100).nullable(),
  charging: z.boolean().nullable(),
  model_loaded: z.boolean(),
  storage_free_gb: z.number().nullable(),
  simulation: z.boolean(),
});
export type HubStatus = z.infer<typeof HubStatus>;

/* ---------- Live events ---------- */

export const HubEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("report.created"), code: ReportCode, urgent: z.boolean() }),
  z.object({ type: z.literal("report.updated"), code: ReportCode, status: ReportStatus }),
  z.object({ type: z.literal("entry.drafted"), entry_id: z.string().uuid() }),
  z.object({ type: z.literal("entry.needs_review"), entry_id: z.string().uuid() }),
  z.object({ type: z.literal("entry.confirmed"), entry_id: z.string().uuid(), report_code: ReportCode.nullable() }),
  z.object({ type: z.literal("update.posted"), update_id: z.string().uuid() }),
  z.object({ type: z.literal("place.saved"), place_id: z.string().uuid() }),
  z.object({ type: z.literal("safe.checked_in"), id: z.string().uuid() }),
  z.object({ type: z.literal("hub.status"), status: HubStatus }),
]);
export type HubEvent = z.infer<typeof HubEvent>;
