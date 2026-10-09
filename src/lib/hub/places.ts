import type { z } from "zod";
import type { NewPlace, NewUpdate } from "@/lib/contracts";

type PlaceType = z.infer<typeof NewPlace>["type"];
type UpdateType = z.infer<typeof NewUpdate>["type"];

const updateTypeFor: Record<PlaceType, UpdateType> = {
  relief: "water_food",
  shelter: "shelter",
  hazard: "hazard",
};

/**
 * The update posted with a new map point when staff tick "post as update".
 * The headline is the place name and the message is its details and time,
 * so phones see the same words as the pin.
 */
export function placeToUpdate(place: z.infer<typeof NewPlace>, placeId: string): z.infer<typeof NewUpdate> {
  const parts = [place.details, place.when_text].map((p) => p?.trim()).filter(Boolean);
  return {
    type: updateTypeFor[place.type],
    headline: place.name,
    message: (parts.length > 0 ? parts.join(". ") : place.name).slice(0, 400),
    message_ceb: null,
    message_tl: null,
    place_id: placeId,
  };
}
