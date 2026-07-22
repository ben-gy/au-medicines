// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Small scale helpers shared by the hand-rolled SVG charts.

export interface Scale {
  (value: number): number;
  invert(pixel: number): number;
  domain: [number, number];
  range: [number, number];
}

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const fn = ((value: number) => {
    if (!Number.isFinite(value)) return r0;
    if (span === 0) return (r0 + r1) / 2;
    return r0 + ((value - d0) / span) * (r1 - r0);
  }) as Scale;
  fn.invert = (pixel: number) => (span === 0 ? d0 : d0 + ((pixel - r0) / (r1 - r0)) * span);
  fn.domain = domain;
  fn.range = range;
  return fn;
}

/**
 * Log scale. Values at or below zero clamp to the domain floor — PBS costs span
 * seven orders of magnitude, and a handful of items legitimately report zero.
 */
export function logScale(domain: [number, number], range: [number, number]): Scale {
  const d0 = Math.max(domain[0], 1e-9);
  const d1 = Math.max(domain[1], d0 * 10);
  const [r0, r1] = range;
  const l0 = Math.log10(d0);
  const l1 = Math.log10(d1);
  const fn = ((value: number) => {
    const v = Math.max(value, d0);
    if (!Number.isFinite(v)) return r0;
    return r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0);
  }) as Scale;
  fn.invert = (pixel: number) => Math.pow(10, l0 + ((pixel - r0) / (r1 - r0)) * (l1 - l0));
  fn.domain = [d0, d1];
  fn.range = range;
  return fn;
}

/** Decade tick values (1, 10, 100 …) inside a log domain. */
export function logTicks(domain: [number, number]): number[] {
  const lo = Math.floor(Math.log10(Math.max(domain[0], 1e-9)));
  const hi = Math.ceil(Math.log10(Math.max(domain[1], 1e-8)));
  const ticks: number[] = [];
  for (let e = lo; e <= hi; e++) {
    const v = Math.pow(10, e);
    if (v >= domain[0] && v <= domain[1]) ticks.push(v);
  }
  return ticks;
}

/** Roughly `count` "nice" round ticks spanning a linear domain. */
export function niceTicks(domain: [number, number], count = 5): number[] {
  const [d0, d1] = domain;
  const span = d1 - d0;
  if (!(span > 0) || !Number.isFinite(span)) return [d0];
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(d0 / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= d1 + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

/** Path `d` for a polyline through (x, y) pairs — used by sparklines and trend lines. */
export function linePath(points: [number, number][]): string {
  if (!points.length) return '';
  return points
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
}
