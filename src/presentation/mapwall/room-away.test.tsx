import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HomeRoom } from "./HomeRoom";
import SpatialRoom from "./SpatialRoom";
import { DEFAULT_HOME_STATE } from "../../domain/home/home";
import { furnitureFor } from "../../domain/home/collection";
const noop = () => {};
it("keeps an autonomous traveller absent in the illustrated room and disables spatial movement controls", () => {
  const furniture = furnitureFor({ tripCount: 0, countryCount: 0 });
  const base = {
    home: DEFAULT_HOME_STATE,
    furniture,
    luggage: "small" as const,
    postcards: [],
    onPerch: noop,
    onMap: noop,
    onSpecialty: noop,
    onPostcard: noop,
    onMoveHome: async () => false,
    onTravel: noop,
  };
  const home = renderToStaticMarkup(<HomeRoom {...base} away />);
  expect(home).not.toContain('class="home-frog room-actor"');
  expect(home).toContain("蛙蛙自己出门旅行了");
  expect(renderToStaticMarkup(<HomeRoom {...base} />)).toContain(
    'class="home-frog room-actor"',
  );
  const space = renderToStaticMarkup(
    <SpatialRoom
      away
      actor={{
        position: { x: 62, y: 74 },
        phase: "seated",
        pose: "front",
        facing: "right",
        jump: 0,
        progress: 0,
        perch: "armchair",
      }}
      luggage="small"
      furniture={furniture}
      postcards={[]}
      specialties={[]}
      city="北京"
      onMove={noop}
      onPose={noop}
      onMap={noop}
      onPostcard={noop}
      onSpecialty={noop}
      onCollection={noop}
      onTravel={noop}
    />,
  );
  expect(space).toMatch(/disabled=""[^>]*>坐回沙发/);
  expect(space).toMatch(/disabled=""[^>]*>走到房间左侧/);
  expect(space).toContain("家里的位置留着，等蛙蛙回来");
  // SSR verifies state/controls only; GPU visibility still needs an actual rendering device.
});
