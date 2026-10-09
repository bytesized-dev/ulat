"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPinIcon } from "lucide-react";
import { routes } from "@/lib/contracts/routes";
import { postUpdate, type NewUpdateInput } from "@/lib/hub/api-client";
import { editDraft, emptyDraft, mergeDraft, type DraftField } from "@/lib/hub/drafts";
import { draftTranslations } from "@/lib/hub/translate-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Textarea } from "@/components/ui/textarea";
import { updateTypeOptions } from "./labels";

type UpdateFormProps = {
  /** Sends the update. Returns false when it did not go through. */
  onPost?: (update: NewUpdateInput) => Promise<boolean>;
};

type Drafting = "idle" | "drafting" | "failed";

const fieldLabel = "text-caption-strong text-ink";

// The new update form on /hub/updates. Staff write in English, the hub drafts
// Bisaya and Tagalog when they leave the message, and staff read and fix the
// drafts before posting.
export function UpdateForm({ onPost = postUpdate }: UpdateFormProps) {
  const router = useRouter();
  const [type, setType] = React.useState<NewUpdateInput["type"]>("water_food");
  const [headline, setHeadline] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [ceb, setCeb] = React.useState<DraftField>(emptyDraft);
  const [tl, setTl] = React.useState<DraftField>(emptyDraft);
  const [drafting, setDrafting] = React.useState<Drafting>("idle");
  const [posting, setPosting] = React.useState(false);
  const [postFailed, setPostFailed] = React.useState(false);
  const lastDrafted = React.useRef("");

  async function draft() {
    const english = { headline: headline.trim(), message: message.trim() };
    const key = `${english.headline}\n${english.message}`;
    if (!english.headline || !english.message || key === lastDrafted.current) return;
    lastDrafted.current = key;
    setDrafting("drafting");
    const result = await draftTranslations(english);
    if (lastDrafted.current !== key) return;
    if (!result.ok) {
      lastDrafted.current = "";
      setDrafting("failed");
      return;
    }
    setCeb((field) => mergeDraft(field, result.ceb));
    setTl((field) => mergeDraft(field, result.tl));
    setDrafting("idle");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPosting(true);
    setPostFailed(false);
    const ok = await onPost({
      type,
      headline: headline.trim(),
      message: message.trim(),
      message_ceb: ceb.text.trim() || null,
      message_tl: tl.text.trim() || null,
      place_id: null,
    });
    setPosting(false);
    if (!ok) {
      setPostFailed(true);
      return;
    }
    setHeadline("");
    setMessage("");
    setCeb(emptyDraft);
    setTl(emptyDraft);
    setDrafting("idle");
    lastDrafted.current = "";
    router.refresh();
  }

  const draftTag = (field: DraftField) =>
    drafting === "drafting" ? "Drafting" : field.fromAi ? "AI draft" : null;

  return (
    <form onSubmit={submit} className="flex max-w-160 flex-col gap-9">
      <h2 className="text-display-lg">New update</h2>

      <Segmented aria-label="Type" name="type" options={updateTypeOptions} value={type} onValueChange={setType} className="self-start" />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="update-headline" className={fieldLabel}>
            Headline
          </Label>
          <Input id="update-headline" size="hub" required maxLength={120} value={headline} onChange={(e) => setHeadline(e.target.value)} onBlur={draft} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="update-message" className={fieldLabel}>
            Message
          </Label>
          <Textarea id="update-message" size="hub" maxLength={400} value={message} onChange={(e) => setMessage(e.target.value)} onBlur={draft} />
        </div>

        <TranslationField id="update-ceb" label="Bisaya" tag={draftTag(ceb)} field={ceb} onChange={setCeb} />
        <TranslationField id="update-tl" label="Tagalog" tag={draftTag(tl)} field={tl} onChange={setTl} />

        {drafting === "failed" ? (
          <p role="status" className="text-body-sm text-muted-text">
            Could not draft. Type it in.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" size="hub" disabled={posting || !headline.trim()}>
            Post to families
          </Button>
          <Button asChild size="hub" variant="secondary">
            <Link href={routes.hub.mapAdd}>
              <MapPinIcon aria-hidden="true" />
              Pin on map
            </Link>
          </Button>
          {postFailed ? (
            <p role="alert" className="text-body-sm text-danger">
              Could not post. Try again.
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function TranslationField({
  id,
  label,
  tag,
  field,
  onChange,
}: {
  id: string;
  label: string;
  tag: string | null;
  field: DraftField;
  onChange: (field: DraftField) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className={`${fieldLabel} justify-between`}>
        {label}
        {tag ? <span className="text-caption text-muted-text">{tag}</span> : null}
      </Label>
      <Textarea id={id} size="hub" maxLength={1000} value={field.text} onChange={(e) => onChange(editDraft(e.target.value))} />
    </div>
  );
}
