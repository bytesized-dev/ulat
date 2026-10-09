import type { Metadata } from "next";
import { VoiceNoteScreen } from "@/components/family/voice-note-screen";

export const metadata: Metadata = { title: "Tell us what happened" };

export default function VoiceNotePage() {
  return <VoiceNoteScreen />;
}
