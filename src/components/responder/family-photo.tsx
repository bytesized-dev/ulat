"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type FamilyPhotoProps = {
  /** The photo id. /api/files serves the family's photo by it. */
  photoId: string;
};

const ALT = "Photo from the family";

// The photo the family added to the report, as a thumbnail that opens full
// screen. Like the voice note, it needs the responder session to load.
function FamilyPhoto({ photoId }: FamilyPhotoProps) {
  const src = `/api/files/${photoId}`;

  return (
    <Dialog>
      <DialogTrigger
        aria-label="Open the photo from the family"
        className="block w-full overflow-hidden rounded-xl bg-surface-soft outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a private hub file, not a remote image */}
        <img src={src} alt={ALT} className="aspect-4/3 w-full object-cover" />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="inset-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 place-items-center rounded-none bg-surface-dark p-0 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{ALT}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element -- a private hub file, not a remote image */}
        <img src={src} alt={ALT} className="max-h-dvh w-full object-contain" />
        <DialogClose asChild>
          <Button variant="outline-dark" size="icon" aria-label="Close the photo" className="absolute top-4 right-4">
            <XIcon aria-hidden="true" />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export { FamilyPhoto };
