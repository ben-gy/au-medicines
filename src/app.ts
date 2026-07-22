// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Dataset } from './types';

export interface AppContext {
  data: Dataset;
  /** Open the drill-down panel for a medicine (also updates the URL hash). */
  openDrug(id: string): void;
  /** Switch the active view. */
  setView(id: string): void;
  /** Persisted per-view UI state (sort order, metric toggles, filters). */
  pref<T>(key: string, fallback: T): T;
  setPref(key: string, value: unknown): void;
}

export interface View {
  id: string;
  label: string;
  /** Sentence shown under the view title explaining what the reader is looking at. */
  blurb: string;
  render(host: HTMLElement, ctx: AppContext): void;
}

/** Escapes text destined for innerHTML. Drug names come from a government CSV. */
export function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Standard card wrapper: title, explanatory subtitle, optional controls and legend. */
export function card(opts: {
  title: string;
  subtitle: string;
  controls?: string;
  legend?: string;
  body: string;
  scroll?: boolean;
  className?: string;
}): string {
  return `
    <section class="card ${opts.className ?? ''}">
      <header class="card-head">
        <div class="card-head-text">
          <h2>${opts.title}</h2>
          <p class="card-sub">${opts.subtitle}</p>
        </div>
        ${opts.controls ? `<div class="card-controls">${opts.controls}</div>` : ''}
      </header>
      ${opts.legend ? `<div class="legend">${opts.legend}</div>` : ''}
      <div class="card-body ${opts.scroll ? 'scroll-x' : ''}">${opts.body}</div>
    </section>
  `;
}

/** Segmented control. `name` is the data attribute the view listens on. */
export function segmented(name: string, options: { value: string; label: string; tip?: string }[], active: string): string {
  return `
    <div class="segmented" role="group">
      ${options
        .map(
          (o) =>
            `<button type="button" data-${name}="${esc(o.value)}" class="${o.value === active ? 'active' : ''}"${
              o.tip ? ` data-tip="${esc(o.tip)}"` : ''
            }>${esc(o.label)}</button>`,
        )
        .join('')}
    </div>
  `;
}

/** Shared legend row for the ATC anatomical groups. */
export function atcLegend(labels: Record<string, string>, colors: Record<string, string>, codes: string[]): string {
  return codes
    .map(
      (c) =>
        `<span class="legend-item" data-tip="${esc(labels[c] ?? c)}"><i style="background:${colors[c]}"></i>${esc(
          shortGroup(labels[c] ?? c),
        )}</span>`,
    )
    .join('');
}

function shortGroup(label: string): string {
  return label.length > 26 ? `${label.slice(0, 24)}…` : label;
}
