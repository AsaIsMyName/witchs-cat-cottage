// Lays out the inventory's items across the spellbook's pages. Pure, so it can be tested.

export interface Span {
  x: number;
  w: number;
}

/**
 * Left x of each item, in order: fills the first page until the next item won't fit, then the
 * next page, and centers each page's row within its span. Items past the last page's room stay on
 * the last page (centered, so they spill over both edges) until the inventory gets real pages.
 */
export function layoutTrayRow(widths: number[], pages: Span[], gap: number): number[] {
  const rows: number[][] = pages.map(() => []);
  let page = 0;
  let used = 0;
  widths.forEach((w, i) => {
    const needed = rows[page].length === 0 ? w : used + gap + w;
    if (needed > pages[page].w && rows[page].length > 0 && page < pages.length - 1) {
      page++;
      used = w;
    } else {
      used = needed;
    }
    rows[page].push(i);
  });

  const xs = new Array<number>(widths.length);
  rows.forEach((row, p) => {
    const rowW = row.reduce((sum, i) => sum + widths[i], 0) + gap * Math.max(0, row.length - 1);
    // Whole pixels, so placeholder edges stay crisp.
    let x = pages[p].x + Math.floor((pages[p].w - rowW) / 2);
    for (const i of row) {
      xs[i] = x;
      x += widths[i] + gap;
    }
  });
  return xs;
}
