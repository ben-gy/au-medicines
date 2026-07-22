// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Small shared SVG builders used across views. Everything is hand-rolled — no
// chart library — so the markup stays inspectable and every mark can carry its
// own data-tip.

import { linePath } from './utils/scale';
import { esc } from './app';

/** Inline sparkline for a monthly series. Fixed 96×24 so table rows stay aligned. */
export function sparkline(values: number[], color: string, opts: { width?: number; height?: number } = {}): string {
  const w = opts.width ?? 96;
  const h = opts.height ?? 24;
  if (!values.length) return `<svg class="spark" width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points: [number, number][] = values.map((v, i) => [i * step, h - 1 - (v / max) * (h - 2)]);
  const area = `${linePath(points)} L ${w.toFixed(2)} ${h} L 0 ${h} Z`;
  return `
    <svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" preserveAspectRatio="none">
      <path d="${area}" fill="${color}" opacity="0.14" />
      <path d="${linePath(points)}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  `;
}

export interface BarRow {
  id: string;
  label: string;
  sub?: string;
  value: number;
  display: string;
  color: string;
  tip: string;
  spark?: string;
}

/** Horizontal ranked bars. Every row is a button — clicking drills into the medicine. */
export function barChart(rows: BarRow[]): string {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `
    <ol class="bar-list">
      ${rows
        .map(
          (r, i) => `
        <li>
          <button type="button" class="bar-row" data-drug="${esc(r.id)}" data-tip="${esc(r.tip)}"
                  aria-label="${esc(r.label)}, ${esc(r.display)}. Open details.">
            <span class="bar-rank">${i + 1}</span>
            <span class="bar-label">${esc(r.label)}${r.sub ? `<em>${esc(r.sub)}</em>` : ''}</span>
            <span class="bar-track">
              <span class="bar-fill" style="width:${Math.max(0.4, (r.value / max) * 100).toFixed(2)}%;background:${r.color}"></span>
            </span>
            ${r.spark ? `<span class="bar-spark">${r.spark}</span>` : ''}
            <span class="bar-value">${esc(r.display)}</span>
          </button>
        </li>`,
        )
        .join('')}
    </ol>
  `;
}

/** Stacked proportion bar (used for the government/patient split). */
export function splitBar(parts: { value: number; color: string; label: string; tip: string }[]): string {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  return `
    <div class="split-bar" role="img" aria-label="${esc(parts.map((p) => p.label).join(' versus '))}">
      ${parts
        .map(
          (p) =>
            `<span style="width:${((p.value / total) * 100).toFixed(2)}%;background:${p.color}" data-tip="${esc(p.tip)}"></span>`,
        )
        .join('')}
    </div>
  `;
}

/** Axis tick label positioned along the bottom of a chart. */
export function axisLabel(x: number, y: number, text: string, anchor = 'middle'): string {
  return `<text class="axis-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${esc(text)}</text>`;
}

export function gridLine(x1: number, y1: number, x2: number, y2: number): string {
  return `<line class="grid-line" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`;
}
