import { describe, expect, it } from "vitest";
import { GazetteerCityResolver } from "./city-resolver";

describe("offline city resolution for real photos", () => {
  it("resolves the Linhai pagoda photo instead of falling back to an unknown city", () => {
    const city = new GazetteerCityResolver().resolve({
      lat: 28.8422,
      lng: 121.1133,
      accuracyM: null,
      source: "exif",
      approximate: false,
    });
    expect(city?.name).toBe("临海");
    expect(city?.countryName).toBe("中国");
  });

  it("keeps the Big Ben photo in London", () => {
    const city = new GazetteerCityResolver().resolve({
      lat: 51.500825,
      lng: -0.12634722222222222,
      accuracyM: null,
      source: "exif",
      approximate: false,
    });
    expect(city?.name).toBe("伦敦");
    expect(city?.countryName).toBe("英国");
  });
});
