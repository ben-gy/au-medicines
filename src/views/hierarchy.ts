// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import { atcColor, tint } from '../colors';
import { card, esc, segmented, type View } from '../app';
import { count, countFull, money, moneyFull, pct } from '../format';
import { titleCase } from '../analysis';
import { arcCentroid, arcLabelRotation, arcPath, partition, type Arc, type TreeNode } from '../utils/sunburst';
import type { Dataset, Metric } from '../types';

const SIZE = 720;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = SIZE / 2 - 12;

const METRICS: { value: string; label: string; tip: string }[] = [
  { value: 'total', label: 'By cost', tip: 'Rings sized by total cost — government plus patients' },
  { value: 'scripts', label: 'By prescriptions', tip: 'Rings sized by how often the medicine is dispensed' },
];

/** Builds the ATC tree, optionally rooted at one anatomical group or subgroup. */
function buildTree(data: Dataset, metric: Metric, focus: string | null): TreeNode {
  const { drugs, labels } = data;
  const value = (d: { total: number; scripts: number }) => (metric === 'scripts' ? d.scripts : d.total);

  const groups = new Map<string, Map<string, TreeNode[]>>();
  for (const d of drugs) {
    if (focus && focus.length === 1 && d.atc1 !== focus) continue;
    if (focus && focus.length === 3 && d.atc2 !== focus) continue;
    if (!groups.has(d.atc1)) groups.set(d.atc1, new Map());
    const subs = groups.get(d.atc1)!;
    if (!subs.has(d.atc2)) subs.set(d.atc2, []);
    subs.get(d.atc2)!.push({
      id: `drug:${d.id}`,
      label: titleCase(d.name),
      value: value(d),
      meta: { kind: 'drug', drugId: d.id, atc1: d.atc1, scripts: d.scripts, total: d.total, cps: d.cps },
    });
  }

  const children: TreeNode[] = [];
  for (const [atc1, subs] of groups) {
    const subNodes: TreeNode[] = [];
    for (const [atc2, leaves] of subs) {
      leaves.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      subNodes.push({
        id: `atc2:${atc2}`,
        label: labels.atc2[atc2] ?? atc2,
        children: leaves,
        meta: { kind: 'atc2', code: atc2, atc1 },
      });
    }
    subNodes.sort((a, b) => sumValue(b) - sumValue(a));
    children.push({
      id: `atc1:${atc1}`,
      label: labels.atc1[atc1] ?? atc1,
      children: subNodes,
      meta: { kind: 'atc1', code: atc1, atc1 },
    });
  }
  children.sort((a, b) => sumValue(b) - sumValue(a));

  // When focused, drop the redundant outer levels so the rings re-expand to fill
  // the circle rather than leaving the reader staring at one thin wedge.
  if (focus && focus.length === 1) return { id: 'root', label: labels.atc1[focus] ?? focus, children: children[0]?.children ?? [] };
  if (focus && focus.length === 3) {
    return { id: 'root', label: labels.atc2[focus] ?? focus, children: children[0]?.children?.[0]?.children ?? [] };
  }
  return { id: 'root', label: 'All medicines', children };
}

function sumValue(node: TreeNode): number {
  if (!node.children?.length) return node.value ?? 0;
  return node.children.reduce((t, c) => t + sumValue(c), 0);
}

export const hierarchyView: View = {
  id: 'hierarchy',
  label: 'Hierarchy',
  blurb:
    'Every medicine filed under the body system it acts on, then its drug class. The rings show where the money actually sits.',

  render(host, ctx) {
    const metric = ctx.pref<Metric>('hierarchy.metric', 'total');
    const focus = ctx.pref<string | null>('hierarchy.focus', null);
    const { labels } = ctx.data;

    const root = buildTree(ctx.data, metric, focus);
    const arcs = partition(root, { radius: RADIUS, innerRadius: RADIUS * 0.2 });
    const total = sumValue(root);

    const fmt = (v: number) => (metric === 'scripts' ? `${countFull(v)} prescriptions` : moneyFull(v));
    const fmtShort = (v: number) => (metric === 'scripts' ? count(v) : money(v));

    // Label only the arcs with room for text; everything else labels on hover.
    const MIN_LABEL_ANGLE = 0.14;
    const MIN_DRAW_ANGLE = 0.0025;

    const groupOf = (arc: Arc): string => String(arc.meta?.atc1 ?? (focus ? focus[0] : 'Z'));
    const fill = (arc: Arc): string => {
      const base = atcColor(groupOf(arc));
      return arc.depth === 1 ? base : arc.depth === 2 ? tint(base, 0.32) : tint(base, 0.58);
    };

    const drawn = arcs.filter((a) => a.a1 - a.a0 > MIN_DRAW_ANGLE);

    const body = `
      <div class="sunburst-wrap">
        <div class="sunburst-figure">
          <svg viewBox="0 0 ${SIZE} ${SIZE}" class="sunburst" role="img"
               aria-label="Sunburst of PBS ${metric === 'scripts' ? 'prescriptions' : 'spending'} by therapeutic classification">
            ${drawn
              .map((arc) => {
                const kind = String(arc.meta?.kind ?? '');
                const drugId = arc.meta?.drugId ? String(arc.meta.drugId) : '';
                const code = arc.meta?.code ? String(arc.meta.code) : '';
                const share = pct(arc.value / (total || 1), 1);
                const tip =
                  `${arc.label}\n${fmt(arc.value)}\n${share} of ${focus ? 'this group' : 'all PBS activity'}` +
                  (kind === 'drug' ? '\nClick for the full profile' : '\nClick to zoom in');
                return `<path class="arc arc-d${arc.depth}" d="${arcPath(arc, CX, CY)}" fill="${fill(arc)}"
                          data-tip="${esc(tip)}" data-kind="${esc(kind)}"
                          ${drugId ? `data-drug="${esc(drugId)}"` : ''} ${code ? `data-code="${esc(code)}"` : ''}
                          tabindex="0" role="button" aria-label="${esc(arc.label)}, ${esc(fmtShort(arc.value))}" />`;
              })
              .join('')}
            ${drawn
              .filter((a) => a.a1 - a.a0 >= MIN_LABEL_ANGLE && a.depth <= 2)
              .map((arc) => {
                const [x, y] = arcCentroid(arc, CX, CY);
                const maxChars = Math.round(((arc.a1 - arc.a0) * ((arc.r0 + arc.r1) / 2)) / 5.4);
                const text = arc.label.length > maxChars ? `${arc.label.slice(0, Math.max(2, maxChars - 1))}…` : arc.label;
                if (maxChars < 4) return '';
                return `<text class="arc-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
                          transform="rotate(${arcLabelRotation(arc).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"
                          text-anchor="middle" dominant-baseline="middle">${esc(text)}</text>`;
              })
              .join('')}
            <circle cx="${CX}" cy="${CY}" r="${(RADIUS * 0.2 - 2).toFixed(1)}" class="sunburst-hub"
                    data-tip="${esc(`${root.label}\n${fmt(total)}${focus ? '\nClick to go back' : ''}`)}"
                    ${focus ? 'data-back="1" tabindex="0" role="button" aria-label="Back to all medicines"' : ''} />
            <text class="hub-value" x="${CX}" y="${CY - 6}" text-anchor="middle">${esc(fmtShort(total))}</text>
            <text class="hub-label" x="${CX}" y="${CY + 12}" text-anchor="middle">${
              focus ? 'click to go back' : metric === 'scripts' ? 'prescriptions' : 'total cost'
            }</text>
          </svg>
        </div>
        <aside class="sunburst-side">
          <h3>${esc(root.label)}</h3>
          <p class="sunburst-total">${esc(fmt(total))}</p>
          <p class="sunburst-help">
            The inner ring is the body system a medicine acts on, the middle ring its drug class, and the outer ring the
            medicine itself. Hover any segment for exact figures, click to zoom in, and click a medicine for its full profile.
          </p>
          <ol class="mini-rank">
            ${(root.children ?? [])
              .slice(0, 10)
              .map((child) => {
                const v = sumValue(child);
                const kind = String(child.meta?.kind ?? '');
                const target = kind === 'atc1' || kind === 'atc2' ? String(child.meta?.code ?? '') : '';
                const drugId = child.meta?.drugId ? String(child.meta.drugId) : '';
                return `<li>
                  <button type="button" class="mini-rank-row"
                          ${drugId ? `data-drug="${esc(drugId)}"` : `data-code="${esc(target)}"`}
                          data-tip="${esc(`${child.label}\n${fmt(v)}\n${pct(v / (total || 1), 1)} of this group`)}">
                    <i style="background:${atcColor(String(child.meta?.atc1 ?? (focus ? focus[0] : 'Z')))}"></i>
                    <span>${esc(child.label)}</span>
                    <b>${esc(fmtShort(v))}</b>
                  </button>
                </li>`;
              })
              .join('')}
          </ol>
          ${focus ? '<button type="button" class="btn-back" data-back="1">← Back to all medicines</button>' : ''}
        </aside>
      </div>
    `;

    host.innerHTML = card({
      title: 'Therapeutic hierarchy',
      subtitle:
        'The WHO classification files every medicine under the body system it acts on, then a drug class. Zoom in by clicking a ring.',
      controls: segmented('hmetric', METRICS, metric),
      legend: focus
        ? `<span class="crumb">All medicines</span> <span class="crumb-sep">›</span> <span class="crumb current">${esc(
            focus.length === 1 ? labels.atc1[focus] ?? focus : labels.atc2[focus] ?? focus,
          )}</span>`
        : '<span class="legend-note">Inner ring: body system · Middle ring: drug class · Outer ring: individual medicine</span>',
      body,
    });

    host.querySelectorAll<HTMLButtonElement>('[data-hmetric]').forEach((btn) =>
      btn.addEventListener('click', () => {
        ctx.setPref('hierarchy.metric', btn.dataset.hmetric);
        hierarchyView.render(host, ctx);
      }),
    );

    const zoomTo = (code: string | null) => {
      ctx.setPref('hierarchy.focus', code);
      hierarchyView.render(host, ctx);
    };

    host.querySelectorAll<HTMLElement>('[data-back]').forEach((el) => {
      const back = () => zoomTo(focus && focus.length === 3 ? focus[0] : null);
      el.addEventListener('click', back);
      el.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') back();
      });
    });

    host.querySelectorAll<HTMLElement>('.arc, .mini-rank-row').forEach((el) => {
      const activate = () => {
        const drugId = el.getAttribute('data-drug');
        if (drugId) {
          ctx.openDrug(drugId);
          return;
        }
        const code = el.getAttribute('data-code');
        if (code) zoomTo(code);
      };
      el.addEventListener('click', activate);
      el.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') activate();
      });
    });
  },
};
