// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Radial partition ("sunburst") layout — pure geometry, no DOM.
//
// The ATC classification is a genuine 3-level tree (14 anatomical groups → ~94
// therapeutic subgroups → ~1,000 medicines), so a partition layout is the right
// form: one ring per level, angle proportional to value, and the ring-by-ring
// reading of "which body system, then which drug class" survives.
//
// Siblings tile their parent's angular span exactly, which is what the
// positional tests assert.

export interface TreeNode {
  id: string;
  label: string;
  /** Own value; ignored when children are present (parents sum their children). */
  value?: number;
  children?: TreeNode[];
  /** Arbitrary payload carried through to the arc (used for colour and click routing). */
  meta?: Record<string, unknown>;
}

export interface Arc {
  id: string;
  label: string;
  value: number;
  depth: number;
  /** Start angle in radians, clockwise from 12 o'clock. */
  a0: number;
  a1: number;
  r0: number;
  r1: number;
  parentId: string | null;
  meta?: Record<string, unknown>;
}

export interface PartitionOptions {
  /** Outer radius of the last ring. */
  radius: number;
  /** Radius of the hole in the middle (the root/breadcrumb disc). */
  innerRadius?: number;
  /** Number of rings to lay out below the root. Defaults to the tree depth. */
  depth?: number;
}

export function nodeValue(node: TreeNode): number {
  if (node.children && node.children.length) {
    let total = 0;
    for (const child of node.children) total += nodeValue(child);
    return total;
  }
  return Math.max(0, node.value ?? 0);
}

export function treeDepth(node: TreeNode): number {
  if (!node.children || !node.children.length) return 0;
  let max = 0;
  for (const child of node.children) max = Math.max(max, treeDepth(child));
  return max + 1;
}

/**
 * Lay out `root`'s descendants as concentric arcs. The root itself is not
 * emitted — it is the centre disc.
 */
export function partition(root: TreeNode, opts: PartitionOptions): Arc[] {
  const radius = opts.radius;
  const inner = opts.innerRadius ?? radius * 0.22;
  const depth = Math.max(1, opts.depth ?? treeDepth(root));
  const ring = depth > 0 ? (radius - inner) / depth : 0;

  const arcs: Arc[] = [];
  const total = nodeValue(root);
  if (!(total > 0) || !(radius > inner)) return arcs;

  const walk = (node: TreeNode, a0: number, a1: number, d: number, parentId: string | null): void => {
    if (d > depth) return;
    if (d > 0) {
      arcs.push({
        id: node.id,
        label: node.label,
        value: nodeValue(node),
        depth: d,
        a0,
        a1,
        r0: inner + (d - 1) * ring,
        r1: inner + d * ring,
        parentId,
        meta: node.meta,
      });
    }
    const children = node.children;
    if (!children || !children.length) return;
    const span = a1 - a0;
    const sum = nodeValue(node);
    if (!(sum > 0) || !(span > 0)) return;
    // Walk a running cursor rather than accumulating per-child offsets, so the
    // last child lands exactly on a1 and siblings never leave a seam or overlap.
    let cursor = a0;
    for (let i = 0; i < children.length; i++) {
      const childValue = nodeValue(children[i]);
      const next = i === children.length - 1 ? a1 : cursor + (childValue / sum) * span;
      walk(children[i], cursor, Math.max(cursor, next), d + 1, node.id);
      cursor = Math.max(cursor, next);
    }
  };

  walk(root, 0, Math.PI * 2, 0, null);
  return arcs;
}

/** SVG path for one arc, centred on (cx, cy). Angles measured from 12 o'clock. */
export function arcPath(arc: Arc, cx: number, cy: number): string {
  const { a0, a1, r0, r1 } = arc;
  const sweep = a1 - a0;
  if (!(sweep > 0) || !(r1 > r0)) return '';

  // A full circle cannot be drawn with a single arc command — split it.
  if (sweep >= Math.PI * 2 - 1e-9) {
    const ring = (r: number, dir: number) =>
      `M ${fmt(cx)} ${fmt(cy - r)} A ${fmt(r)} ${fmt(r)} 0 1 ${dir} ${fmt(cx)} ${fmt(cy + r)} A ${fmt(r)} ${fmt(r)} 0 1 ${dir} ${fmt(cx)} ${fmt(cy - r)} Z`;
    return `${ring(r1, 1)} ${ring(r0, 0)}`;
  }

  const p = (angle: number, r: number): [number, number] => [cx + Math.sin(angle) * r, cy - Math.cos(angle) * r];
  const large = sweep > Math.PI ? 1 : 0;
  const [x0o, y0o] = p(a0, r1);
  const [x1o, y1o] = p(a1, r1);
  const [x1i, y1i] = p(a1, r0);
  const [x0i, y0i] = p(a0, r0);

  if (r0 <= 0) {
    return `M ${fmt(cx)} ${fmt(cy)} L ${fmt(x0o)} ${fmt(y0o)} A ${fmt(r1)} ${fmt(r1)} 0 ${large} 1 ${fmt(x1o)} ${fmt(y1o)} Z`;
  }
  return (
    `M ${fmt(x0o)} ${fmt(y0o)} ` +
    `A ${fmt(r1)} ${fmt(r1)} 0 ${large} 1 ${fmt(x1o)} ${fmt(y1o)} ` +
    `L ${fmt(x1i)} ${fmt(y1i)} ` +
    `A ${fmt(r0)} ${fmt(r0)} 0 ${large} 0 ${fmt(x0i)} ${fmt(y0i)} Z`
  );
}

/** Mid-angle point of an arc, for label placement. */
export function arcCentroid(arc: Arc, cx: number, cy: number): [number, number] {
  const a = (arc.a0 + arc.a1) / 2;
  const r = (arc.r0 + arc.r1) / 2;
  return [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
}

/** Degrees of rotation that keeps an arc label upright and tangential. */
export function arcLabelRotation(arc: Arc): number {
  const mid = ((arc.a0 + arc.a1) / 2) * (180 / Math.PI);
  return mid > 180 ? mid - 270 : mid - 90;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0';
}
