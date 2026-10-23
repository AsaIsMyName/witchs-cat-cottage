import { describe, expect, it } from "vitest";
import { standShape } from "./stand";

describe("standShape", () => {
  it("draws a rug flat, as just its footprint seen from above", () => {
    expect(standShape({ layer: "rug", height: 1, standHeight: 0.5 })).toEqual({ top: 0, topFace: 1, frontFace: 0, bottom: 1 });
  });

  it("lifts a floor item's top face by its stand height, with the front face filling the gap", () => {
    expect(standShape({ layer: "floor", height: 1, standHeight: 0.75 })).toEqual({
      top: -0.75,
      topFace: 1,
      frontFace: 0.75,
      bottom: 1,
    });
  });

  it("draws a 1-tile item a whole tile taller than its footprint", () => {
    const s = standShape({ layer: "floor", height: 1, standHeight: 1 });
    expect(s.bottom - s.top).toBe(2);
    expect(s.topFace + s.frontFace).toBe(2);
  });

  it("keeps a deep footprint's top face as deep as the footprint", () => {
    const s = standShape({ layer: "floor", height: 2, standHeight: 0.5 });
    expect(s.topFace).toBe(2);
    expect(s.bottom).toBe(2);
  });

  it("treats a missing or negative stand height as flat", () => {
    expect(standShape({ layer: "floor", height: 1 }).frontFace).toBe(0);
    expect(standShape({ layer: "floor", height: 1, standHeight: -1 }).top).toBe(0);
  });
});
