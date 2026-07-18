// Label de-collision for charts where marks can land arbitrarily close
// together — the slope chart in particular, where a log axis routinely stacks
// several medicines within a few pixels and their names overprint each other.
//
// Marks stay at their true positions; only the *labels* are nudged apart, which
// preserves the data while keeping the text readable.

/**
 * Push overlapping label positions apart so no two are closer than `minGap`,
 * preserving their relative order and staying within [min, max].
 *
 * Returns positions in the same order as the input.
 */
export function declutter(positions: number[], minGap: number, min: number, max: number): number[] {
  const n = positions.length;
  if (n === 0) return [];
  if (n === 1) return [clamp(positions[0], min, max)];

  // Work in sorted order so the sweep only ever pushes downward.
  const order = positions.map((y, i) => ({ y: Number.isFinite(y) ? y : min, i })).sort((a, b) => a.y - b.y);

  // If everything cannot fit, distribute evenly rather than piling up at the end.
  const needed = minGap * (n - 1);
  if (needed > max - min) {
    const step = (max - min) / (n - 1);
    const out = new Array<number>(n);
    order.forEach((entry, rank) => { out[entry.i] = min + rank * step; });
    return out;
  }

  // Forward: no label may sit less than minGap below its predecessor.
  const laid = order.map((entry) => entry.y);
  laid[0] = Math.max(laid[0], min);
  for (let i = 1; i < n; i++) laid[i] = Math.max(laid[i], laid[i - 1] + minGap);

  // Backward: if the sweep overran the bottom, pull the tail back up.
  if (laid[n - 1] > max) {
    laid[n - 1] = max;
    for (let i = n - 2; i >= 0; i--) laid[i] = Math.min(laid[i], laid[i + 1] - minGap);
  }

  const out = new Array<number>(n);
  order.forEach((entry, rank) => { out[entry.i] = clamp(laid[rank], min, max); });
  return out;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
