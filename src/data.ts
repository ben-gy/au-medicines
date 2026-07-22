// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Dataset, DrugDetail, Drug, Labels, Matrix, Meta, Monthly } from './types';

const BASE = `${import.meta.env.BASE_URL ?? '/'}data`.replace(/\/{2,}/g, '/');

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { signal });
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

export async function loadDataset(signal?: AbortSignal): Promise<Dataset> {
  const [meta, drugs, labels, monthly, matrix] = await Promise.all([
    getJson<Meta>('meta.json', signal),
    getJson<Drug[]>('drugs.json', signal),
    getJson<Labels>('labels.json', signal),
    getJson<Monthly>('monthly.json', signal),
    getJson<Matrix>('matrix.json', signal),
  ]);
  return { meta, drugs, labels, monthly, matrix, byId: new Map(drugs.map((d) => [d.id, d])) };
}

const detailCache = new Map<string, DrugDetail>();

/** Per-medicine breakdowns, fetched only when the drill-down actually opens. */
export async function loadDetail(id: string, signal?: AbortSignal): Promise<DrugDetail> {
  const cached = detailCache.get(id);
  if (cached) return cached;
  const detail = await getJson<DrugDetail>(`drugs/${id}.json`, signal);
  detailCache.set(id, detail);
  return detail;
}
