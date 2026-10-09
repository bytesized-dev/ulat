import type { Metadata } from "next";
import { TypeNoteForm } from "@/components/family/type-note-form";

export const metadata: Metadata = { title: "Tell us what happened" };

export default function TypeInsteadPage() {
  return <TypeNoteForm />;
}
