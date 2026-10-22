import { describe, expect, it } from "vitest";
import { layoutTrayRow, type Span } from "./tray";

const pages: Span[] = [
  { x: 0, w: 100 },
  { x: 200, w: 100 },
];

function within(xs: number[], widths: number[], page: Span, indexes: number[]): boolean {
  return indexes.every((i) => xs[i] >= page.x && xs[i] + widths[i] <= page.x + page.w);
}

describe("layoutTrayRow", () => {
  it("centers a row that fits on the first page", () => {
    expect(layoutTrayRow([20, 30], pages, 10)).toEqual([20, 50]);
  });

  it("moves on to the next page when an item won't fit, keeping order", () => {
    const widths = [40, 40, 40, 10];
    const xs = layoutTrayRow(widths, pages, 10);
    expect(within(xs, widths, pages[0], [0, 1])).toBe(true);
    expect(within(xs, widths, pages[1], [2, 3])).toBe(true);
    expect(xs).toEqual([5, 55, 220, 270]);
  });

  it("keeps extra items on the last page", () => {
    const xs = layoutTrayRow([90, 90, 90], pages, 10);
    expect(xs[0]).toBe(5);
    expect(xs[1]).toBeGreaterThan(150);
    expect(xs[2]).toBeGreaterThan(xs[1]);
  });

  it("fits today's starting inventory on the two spellbook pages", () => {
    // frame, moon chart, shelf, clock, table, stool, rug, cauldron, candle, potion
    const widths = [48, 48, 48, 48, 96, 48, 96, 48, 24, 24];
    const book: Span[] = [
      { x: 21, w: 347 },
      { x: 400, w: 347 },
    ];
    const xs = layoutTrayRow(widths, book, 12);
    expect(within(xs, widths, book[0], [0, 1, 2, 3, 4])).toBe(true);
    expect(within(xs, widths, book[1], [5, 6, 7, 8, 9])).toBe(true);
  });

  it("handles an empty inventory", () => {
    expect(layoutTrayRow([], pages, 10)).toEqual([]);
  });
});
