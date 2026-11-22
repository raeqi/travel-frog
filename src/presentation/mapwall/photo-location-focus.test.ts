import { describe, expect, it } from "vitest";
import type { Candidate } from "../../domain/candidate/candidate";
import type { CityRef } from "../../domain/city/city-ref";
import type { GeoPoint } from "../../domain/geo/geo-point";
import type { Photo } from "../../domain/photo/photo";
import type { LocationSuggestion } from "../../domain/services/fill-locations";
import type { Trip } from "../../domain/trip/trip";
import type { Visit } from "../../domain/visit/visit";
import { PHOTO_LOCATION_ZOOM, photoLocationFocus } from "./photo-location-focus";

function geo(lat: number, lng: number): GeoPoint {
  return { lat, lng, accuracyM: null, source: "exif", approximate: false };
}

function city(name: string, lat: number, lng: number): CityRef {
  return {
    key: `XXX:${name}`,
    name,
    countryCode: "XXX",
    countryName: "示例国",
    centroid: geo(lat, lng),
    source: "gazetteer",
    confidence: "high",
  };
}

function photo(patch: Partial<Photo> = {}): Photo {
  return {
    id: "photo_1",
    geo: null,
    tripId: null,
    capturedAt: Date.UTC(2026, 4, 1),
    ...patch,
  } as Photo;
}

function suggestion(
  photoId: string,
  point: GeoPoint,
  cityRef: CityRef,
): LocationSuggestion {
  return {
    photoId,
    geo: point,
    cityRef,
    reason: "same-day-gps",
    sourcePhotoIds: ["photo_2"],
    timeDeltaMs: 1000,
    distanceKm: 0,
    confidence: "high",
  };
}

function base(patch: Partial<Parameters<typeof photoLocationFocus>[0]> = {}) {
  return {
    photos: [photo()],
    suggestions: [],
    candidates: [],
    trips: [],
    visits: [],
    ...patch,
  };
}

describe("photo location focus", () => {
  it("uses an existing coordinate first", () => {
    const point = geo(48.85, 2.35);
    const focus = photoLocationFocus(
      base({
        photos: [photo({ geo: point })],
        suggestions: [
          suggestion("photo_1", geo(1, 1), city("错误建议", 1, 1)),
        ],
      }),
    );
    expect(focus).toEqual({
      lat: point.lat,
      lng: point.lng,
      zoom: PHOTO_LOCATION_ZOOM,
    });
  });

  it("uses a same-day suggestion before a broad candidate city", () => {
    const focus = photoLocationFocus(
      base({
        suggestions: [
          suggestion("photo_1", geo(48.86, 2.29), city("巴黎", 48.85, 2.35)),
        ],
        candidates: [
          {
            photoIds: ["photo_1"],
            cityRefs: [city("法国", 46.6, 2.2)],
          } as unknown as Candidate,
        ],
      }),
    );
    expect(focus).toMatchObject({ lat: 48.86, lng: 2.29 });
  });

  it("falls back to the candidate city when there is no suggestion", () => {
    const focus = photoLocationFocus(
      base({
        candidates: [
          {
            photoIds: ["other", "photo_1"],
            cityRefs: [city("京都", 35.01, 135.76)],
          } as unknown as Candidate,
        ],
      }),
    );
    expect(focus).toMatchObject({
      lat: 35.01,
      lng: 135.76,
      zoom: PHOTO_LOCATION_ZOOM,
    });
  });

  it("uses a confirmed visit or trip city for an already archived photo", () => {
    const visitFocus = photoLocationFocus(
      base({
        photos: [photo({ tripId: "trip_1" as Photo["tripId"] })],
        visits: [
          {
            tripId: "trip_1",
            cityRef: city("大阪", 34.69, 135.5),
          } as Visit,
        ],
      }),
    );
    expect(visitFocus).toMatchObject({ lat: 34.69, lng: 135.5 });

    const tripFocus = photoLocationFocus(
      base({
        photos: [photo({ tripId: "trip_1" as Photo["tripId"] })],
        trips: [
          {
            id: "trip_1",
            cityRefs: [city("罗马", 41.9, 12.49)],
          } as unknown as Trip,
        ],
      }),
    );
    expect(tripFocus).toMatchObject({ lat: 41.9, lng: 12.49 });
  });

  it("returns null instead of inventing a location", () => {
    expect(photoLocationFocus(base())).toBeNull();
  });
});
