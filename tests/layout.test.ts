// Positional tests for the sunburst partition layout.
//
// Area-only assertions pass on visually broken layouts — a partition that stacks
// every arc at the same angle conserves total area perfectly and renders as
// garbage. These assert positions: in bounds, no sibling overlap, seams flush,
// no NaN.

import { describe, expect, it } from 'vitest';
import { arcCentroid, arcLabelRotation, arcPath, nodeValue, partition, treeDepth, type TreeNode } from '../src/utils/sunburst';

const TAU = Math.PI * 2;

function tree(): TreeNode {
  return {
    id: 'root',
    label: 'All',
    children: [
      {
        id: 'a',
        label: 'A',
        children: [
          { id: 'a1', label: 'A1', children: [{ id: 'a1x', label: 'A1x', value: 30 }, { id: 'a1y', label: 'A1y', value: 10 }] },
          { id: 'a2', label: 'A2', children: [{ id: 'a2x', label: 'A2x', value: 20 }] },
        ],
      },
      {
        id: 'b',
        label: 'B',
        children: [{ id: 'b1', label: 'B1', children: [{ id: 'b1x', label: 'B1x', value: 40 }] }],
      },
    ],
  };
}

describe('nodeValue / treeDepth', () => {
  it('sums leaves up the tree', () => {
    expect(nodeValue(tree())).toBe(100);
  });

  it('reports the depth of the deepest branch', () => {
    expect(treeDepth(tree())).toBe(3);
  });

  it('treats a bare leaf as depth zero', () => {
    expect(treeDepth({ id: 'x', label: 'x', value: 5 })).toBe(0);
  });

  it('clamps negative values to zero rather than producing a negative span', () => {
    expect(nodeValue({ id: 'x', label: 'x', value: -20 })).toBe(0);
  });
});

describe('partition layout', () => {
  const arcs = partition(tree(), { radius: 300, innerRadius: 60 });

  it('emits every descendant but not the root', () => {
    // a, a1, a1x, a1y, a2, a2x, b, b1, b1x — every node except the root.
    expect(arcs).toHaveLength(9);
    expect(arcs.some((a) => a.id === 'root')).toBe(false);
  });

  it('produces no NaN or undefined coordinates', () => {
    for (const a of arcs) {
      for (const v of [a.a0, a.a1, a.r0, a.r1]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('keeps every arc inside the radius and outside the hole', () => {
    for (const a of arcs) {
      expect(a.r0).toBeGreaterThanOrEqual(60 - 1e-9);
      expect(a.r1).toBeLessThanOrEqual(300 + 1e-9);
      expect(a.r1).toBeGreaterThan(a.r0);
      expect(a.a0).toBeGreaterThanOrEqual(-1e-9);
      expect(a.a1).toBeLessThanOrEqual(TAU + 1e-9);
      expect(a.a1).toBeGreaterThanOrEqual(a.a0);
    }
  });

  it('tiles the full circle at every depth with no gaps or overlaps', () => {
    for (const depth of [1, 2, 3]) {
      const ring = arcs.filter((a) => a.depth === depth).sort((x, y) => x.a0 - y.a0);
      expect(ring.length).toBeGreaterThan(0);
      expect(ring[0].a0).toBeCloseTo(0, 9);
      expect(ring.at(-1)!.a1).toBeCloseTo(TAU, 9);
      for (let i = 1; i < ring.length; i++) {
        // Flush seams: each arc starts exactly where the previous one ended.
        expect(ring[i].a0).toBeCloseTo(ring[i - 1].a1, 9);
      }
      const span = ring.reduce((t, a) => t + (a.a1 - a.a0), 0);
      expect(span).toBeCloseTo(TAU, 9);
    }
  });

  it('nests children strictly inside their parent’s angular span', () => {
    const byId = new Map(arcs.map((a) => [a.id, a]));
    for (const a of arcs) {
      if (!a.parentId || a.parentId === 'root') continue;
      const parent = byId.get(a.parentId)!;
      expect(a.a0).toBeGreaterThanOrEqual(parent.a0 - 1e-9);
      expect(a.a1).toBeLessThanOrEqual(parent.a1 + 1e-9);
    }
  });

  it('sizes arcs in proportion to their value', () => {
    const a = arcs.find((x) => x.id === 'a')!;
    const b = arcs.find((x) => x.id === 'b')!;
    // A is 60 of 100, B is 40.
    expect((a.a1 - a.a0) / TAU).toBeCloseTo(0.6, 9);
    expect((b.a1 - b.a0) / TAU).toBeCloseTo(0.4, 9);
  });

  it('gives every ring an equal radial thickness', () => {
    const thickness = arcs.map((a) => a.r1 - a.r0);
    for (const t of thickness) expect(t).toBeCloseTo(thickness[0], 9);
    expect(thickness[0]).toBeCloseTo((300 - 60) / 3, 9);
  });

  it('returns nothing for degenerate inputs rather than NaN geometry', () => {
    expect(partition({ id: 'r', label: 'r', children: [] }, { radius: 100 })).toEqual([]);
    expect(partition({ id: 'r', label: 'r', value: 0 }, { radius: 100 })).toEqual([]);
    expect(partition(tree(), { radius: 10, innerRadius: 40 })).toEqual([]);
  });

  it('handles a single child spanning the whole circle', () => {
    const arcs1 = partition({ id: 'r', label: 'r', children: [{ id: 'only', label: 'only', value: 7 }] }, { radius: 100 });
    expect(arcs1).toHaveLength(1);
    expect(arcs1[0].a0).toBeCloseTo(0, 9);
    expect(arcs1[0].a1).toBeCloseTo(TAU, 9);
  });

  it('ignores zero-value children without leaving a gap', () => {
    const arcs2 = partition(
      { id: 'r', label: 'r', children: [{ id: 'x', label: 'x', value: 10 }, { id: 'z', label: 'z', value: 0 }] },
      { radius: 100 },
    );
    const x = arcs2.find((a) => a.id === 'x')!;
    expect(x.a1 - x.a0).toBeCloseTo(TAU, 9);
    expect(arcs2.at(-1)!.a1).toBeCloseTo(TAU, 9);
  });

  it('respects an explicit depth limit', () => {
    const shallow = partition(tree(), { radius: 300, depth: 2 });
    expect(Math.max(...shallow.map((a) => a.depth))).toBe(2);
  });
});

describe('arcPath', () => {
  const arcs = partition(tree(), { radius: 300, innerRadius: 60 });

  it('produces a finite path for every arc', () => {
    for (const a of arcs) {
      const d = arcPath(a, 400, 400);
      expect(d).not.toBe('');
      expect(d).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('closes a full-circle arc with two sub-paths rather than one degenerate arc', () => {
    const full = partition({ id: 'r', label: 'r', children: [{ id: 'o', label: 'o', value: 1 }] }, { radius: 100, innerRadius: 40 });
    const d = arcPath(full[0], 200, 200);
    expect(d.match(/M /g)?.length).toBe(2);
    expect(d).not.toMatch(/NaN/);
  });

  it('returns an empty path for a zero-width or zero-thickness arc', () => {
    expect(arcPath({ id: 'x', label: 'x', value: 0, depth: 1, a0: 1, a1: 1, r0: 10, r1: 20, parentId: null }, 0, 0)).toBe('');
    expect(arcPath({ id: 'x', label: 'x', value: 0, depth: 1, a0: 0, a1: 1, r0: 20, r1: 20, parentId: null }, 0, 0)).toBe('');
  });

  it('places a centroid inside the arc’s radial band', () => {
    for (const a of arcs) {
      const [x, y] = arcCentroid(a, 400, 400);
      const r = Math.hypot(x - 400, y - 400);
      expect(r).toBeGreaterThanOrEqual(a.r0 - 1e-6);
      expect(r).toBeLessThanOrEqual(a.r1 + 1e-6);
    }
  });

  it('keeps arc labels upright on both sides of the circle', () => {
    for (const a of arcs) {
      const rot = arcLabelRotation(a);
      expect(rot).toBeGreaterThanOrEqual(-91);
      expect(rot).toBeLessThanOrEqual(91);
    }
  });
});
