"use client";

import { useId, useRef, useState } from "react";
import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { smsSegments } from "@/lib/sms";

/**
 * The SMS text built by buildSms, with its character count and how many texts
 * it takes. Staff can trim it before copying, and the counts follow the edit.
 */
export function SmsPanel({ sms }: { sms: string }) {
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(sms);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const texts = smsSegments(text);

  async function copyText() {
    let done = false;
    try {
      await navigator.clipboard.writeText(text);
      done = true;
    } catch {
      // No clipboard permission, so select the text and use the older copy command.
      field.current?.select();
      done = document.execCommand("copy");
    }
    setCopy(done ? "copied" : "failed");
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-title`} className="text-title-md text-ink">
          SMS summary
        </h2>
        <p className="font-mono text-mono-sm text-muted-text tabular">
          <span aria-hidden="true">{text.length}</span>
          <span className="sr-only">{`${text.length} characters`}</span>
        </p>
      </div>
      <label htmlFor={id} className="sr-only">
        SMS summary
      </label>
      <Textarea
        ref={field}
        id={id}
        size="hub"
        rows={8}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setCopy("idle");
        }}
        className="resize-y text-body-sm"
      />
      <p className="text-body-sm text-body" aria-live="polite">
        {`${text.length} characters, ${texts} ${texts === 1 ? "text" : "texts"}`}
      </p>
      <div className="flex flex-col items-start gap-2">
        <Button variant="secondary" size="hub" onClick={copyText}>
          <CopyIcon aria-hidden="true" />
          {copy === "copied" ? "Copied" : "Copy"}
        </Button>
        {copy === "failed" ? (
          <p role="alert" className="text-body-sm text-danger">
            Could not copy. The text is selected, press Ctrl C.
          </p>
        ) : null}
      </div>
    </section>
  );
}
