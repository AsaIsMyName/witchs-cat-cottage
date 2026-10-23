import { describe, expect, it } from "vitest";
import { CATALOG, ITEMS, STARTING_INVENTORY } from "./items";

// Guards the catalog against rows that break the design rules in CLAUDE.md.
describe("item catalog", () => {
  it("has unique ids", () => {
    expect(Object.keys(CATALOG)).toHaveLength(ITEMS.length);
  });

  it.each(ITEMS)("$id has an allowed footprint", (item) => {
    const footprint = `${item.width}x${item.height}`;
    if (item.layer === "floor" || item.layer === "rug") expect(["1x1", "2x1", "2x2"]).toContain(footprint);
    else expect(footprint).toBe("1x1");
  });

  it.each(ITEMS)("$id only has a surface if it is furniture or a shelf", (item) => {
    if (item.hasSurface) expect(["floor", "wall"]).toContain(item.layer);
  });

  it.each(ITEMS)("$id has 1–3 tags", (item) => {
    expect(item.tags.length).toBeGreaterThanOrEqual(1);
    expect(item.tags.length).toBeLessThanOrEqual(3);
  });

  it.each(ITEMS)("$id only stands up if it is a floor item, by 0–2 tiles", (item) => {
    if (item.layer !== "floor") expect(item.standHeight).toBeUndefined();
    else {
      expect(item.standHeight ?? 0).toBeGreaterThanOrEqual(0);
      expect(item.standHeight ?? 0).toBeLessThanOrEqual(2);
    }
  });

  // The book's page height, and so the whole room's layout, follows the tallest item: past about
  // 3 tiles drawn, the top wall row is pushed off-screen. Raise this only with a layout change.
  it.each(ITEMS)("$id is drawn at most 3 tiles tall", (item) => {
    expect(item.height + (item.standHeight ?? 0)).toBeLessThanOrEqual(3);
  });

  it("starts the tray with known items only", () => {
    for (const id of Object.keys(STARTING_INVENTORY)) expect(CATALOG[id]).toBeDefined();
  });
});
