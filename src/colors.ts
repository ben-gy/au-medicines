// One colour per ATC anatomical group, used identically in every view — the
// rankings bars, the sunburst rings, the scatter dots, the trend bands and the
// matrix legend. A medicine is the same colour everywhere it appears.
//
// Chosen for legibility on the off-white background at small sizes (a 6px
// scatter dot and a 3px sunburst arc both have to read).
export const ATC_COLORS: Record<string, string> = {
  A: '#0f766e', // alimentary & metabolism — teal (the house accent)
  B: '#b91c1c', // blood — deep red
  C: '#1d4ed8', // cardiovascular — blue
  D: '#c2410c', // dermatologicals — burnt orange
  G: '#a21caf', // genito-urinary & sex hormones — magenta
  H: '#0891b2', // systemic hormones — cyan
  J: '#4d7c0f', // antiinfectives — olive
  L: '#7c3aed', // cancer & immune — violet
  M: '#a16207', // musculo-skeletal — ochre
  N: '#be123c', // nervous system — rose
  P: '#15803d', // antiparasitics — green
  R: '#0369a1', // respiratory — steel blue
  S: '#9d174d', // sensory organs — plum
  V: '#57534e', // various — warm grey
  Z: '#94a3b8', // unclassified — cool grey
};

export const ATC_ORDER = ['A', 'B', 'C', 'D', 'G', 'H', 'J', 'L', 'M', 'N', 'P', 'R', 'S', 'V', 'Z'];

export function atcColor(code: string): string {
  return ATC_COLORS[code] ?? ATC_COLORS.Z;
}

/** Lighter tint of a group colour, for sunburst outer rings and hover fills. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`;
}

/** Sequential teal ramp for the heatmap, 0 → 1. */
export function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // #f0fdfa → #0f766e, perceptually eased so mid values stay distinguishable.
  const eased = Math.pow(clamped, 0.6);
  const from = [240, 253, 250];
  const to = [15, 118, 110];
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * eased));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
