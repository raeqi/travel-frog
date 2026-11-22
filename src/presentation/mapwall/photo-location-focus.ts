import type { Candidate } from "../../domain/candidate/candidate";
import type { Photo } from "../../domain/photo/photo";
import type { LocationSuggestion } from "../../domain/services/fill-locations";
import type { Trip } from "../../domain/trip/trip";
import type { Visit } from "../../domain/visit/visit";

/** Country/region framing: the offline world map has country outlines, not streets. */
export const PHOTO_LOCATION_ZOOM = 60;

export interface PhotoLocationFocus {
  readonly lat: number;
  readonly lng: number;
  readonly zoom: number;
}

export interface PhotoLocationFocusInput {
  readonly photos: readonly Photo[];
  readonly suggestions: readonly LocationSuggestion[];
  readonly candidates: readonly Candidate[];
  readonly trips: readonly Trip[];
  readonly visits: readonly Visit[];
}

function at(point: { lat: number; lng: number }): PhotoLocationFocus {
  return { lat: point.lat, lng: point.lng, zoom: PHOTO_LOCATION_ZOOM };
}

/**
 * Chooses a useful starting view without inventing a location:
 * existing coordinate > same-day suggestion > candidate city > visit/trip city.
 */
export function photoLocationFocus(
  input: PhotoLocationFocusInput,
): PhotoLocationFocus | null {
  const ids = new Set<string>(input.photos.map((photo) => photo.id));

  const located = input.photos.find((photo) => photo.geo !== null);
  if (located?.geo) return at(located.geo);

  const suggestion = input.suggestions.find((item) => ids.has(item.photoId));
  if (suggestion) return at(suggestion.geo);

  const candidate = input.candidates.find((item) =>
    item.photoIds.some((id) => ids.has(id)),
  );
  const candidateCentroid = candidate?.cityRefs.find((ref) => ref.centroid)?.centroid;
  if (candidateCentroid) return at(candidateCentroid);

  const photo = input.photos[0];
  if (photo?.tripId) {
    const visit = input.visits.find(
      (item) => item.tripId === photo.tripId && item.cityRef.centroid,
    );
    if (visit?.cityRef.centroid) return at(visit.cityRef.centroid);
    const trip = input.trips.find((item) => item.id === photo.tripId);
    const tripCentroid = trip?.cityRefs.find((ref) => ref.centroid)?.centroid;
    if (tripCentroid) return at(tripCentroid);
  }

  return null;
}
