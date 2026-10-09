"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchPill } from "@/components/ui/search-pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { formatTime } from "@/lib/time";
import { parseFound, saveCheckedIn, searchUrl, sendCheckin, initials, type Found } from "./safe-checkin";

type SafeFormProps = {
  /** The barangays from the hub's settings. */
  barangays: string[];
  /** The shelters, then "With relatives" and "At home". */
  stayingOptions: string[];
};

function ListSelect({ id, value, options, onChange }: { id: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SEARCH_FAILED = "Could not reach the hub. Try again.";

const fieldLabel = "text-body-sm font-semibold text-ink";

// Check in on the safe list, and find someone by name. The search reads only
// the name, where they are staying and the time, which is all the hub returns.
export function SafeForm({ barangays, stayingOptions }: SafeFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [barangay, setBarangay] = useState(barangays[0] ?? "");
  const [stayingAt, setStayingAt] = useState(stayingOptions[0] ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  // people is null when the search failed, so it does not read as no results.
  const [found, setFound] = useState<{ url: string; people: Found[] | null } | null>(null);
  const url = searchUrl(query);

  // Wait for a pause in typing, and drop an answer that arrives after a newer search.
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(url, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`GET ${url} ${response.status}`);
          return response.json();
        })
        .then((body) => setFound({ url, people: parseFound(body) }))
        .catch(() => {
          if (!controller.signal.aborted) setFound({ url, people: null });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url]);

  const answer = url && found?.url === url ? found : null;
  const people = answer?.people ?? null;
  const searchFailed = answer !== null && answer.people === null;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await sendCheckin({ name, barangay, staying_at: stayingAt, message });
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    saveCheckedIn({ name: name.trim(), staying_at: stayingAt });
    // Replace, so Back from the confirmation does not offer to check in again.
    router.replace(routes.family.safeDone);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      <TopBar as="p" title="I'm safe" leading={{ kind: "back", href: routes.family.home }} />
      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h1 className="text-title-page text-ink">Tell family you&apos;re safe</h1>
          <div className="flex flex-col gap-2">
            <Label htmlFor="safe-name" className={fieldLabel}>
              Your name
            </Label>
            <Input id="safe-name" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="safe-barangay" className={fieldLabel}>
              Barangay
            </Label>
            <ListSelect id="safe-barangay" value={barangay} options={barangays} onChange={setBarangay} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="safe-staying" className={fieldLabel}>
              Staying at
            </Label>
            <ListSelect id="safe-staying" value={stayingAt} options={stayingOptions} onChange={setStayingAt} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="safe-message" className={fieldLabel}>
              Message, optional
            </Label>
            <Textarea id="safe-message" maxLength={240} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <p role="alert" className={error ? "text-body-sm text-danger" : "sr-only"}>
            {error}
          </p>
          <Button type="submit" disabled={busy || name.trim() === ""}>
            Add me to the safe list
          </Button>
        </form>

        <section aria-labelledby="safe-find" className="flex flex-col gap-3">
          <h2 id="safe-find" className="text-title-md text-ink">
            Find someone
          </h2>
          <SearchPill aria-label="Search by name" value={query} onChange={(e) => {
              setQuery(e.target.value);
              // A new search starts clean, so the last answer or error does not show for it.
              setFound(null);
            }}
          />
          {/* Mounted from the start, so a screen reader announces the first results or the error. */}
          <div aria-live="polite">
            {people && people.length > 0 ? (
              <ul>
                {people.map((person) => (
                  <li key={`${person.name}-${person.at}`} className="flex min-h-16 items-center gap-4 border-b border-hairline-soft py-3 last:border-b-0">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-strong text-caption-strong text-ink">
                      {initials(person.name)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-body-md font-medium text-ink">{person.name}</span>
                      <span className="text-body-sm text-body">
                        {person.staying_at}, {formatTime(person.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : searchFailed ? (
              <p className="text-body-sm text-danger">{SEARCH_FAILED}</p>
            ) : (
              <p className="text-body-sm text-body">{people ? "No one with that name yet." : null}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
