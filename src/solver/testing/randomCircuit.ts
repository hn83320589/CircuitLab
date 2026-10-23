import fc from 'fast-check';
import { UnionFind } from '../unionFind';
import type { NetSpec } from './layout';

type EdgeProps = {
  kind: NetSpec['kind'];
  resistance: number;
  emf: number;
  internalR: number;
  closed: boolean;
};

const edgePropsArb: fc.Arbitrary<EdgeProps> = fc.record({
  kind: fc.oneof(
    { weight: 30, arbitrary: fc.constant('resistor' as const) },
    { weight: 15, arbitrary: fc.constant('bulb' as const) },
    { weight: 20, arbitrary: fc.constant('battery' as const) },
    { weight: 8, arbitrary: fc.constant('wire' as const) },
    { weight: 7, arbitrary: fc.constant('ammeter' as const) },
    { weight: 10, arbitrary: fc.constant('switch' as const) },
    { weight: 10, arbitrary: fc.constant('voltmeter' as const) },
  ),
  resistance: fc.double({ min: 0.1, max: 1000, noNaN: true }),
  emf: fc.double({ min: 0.5, max: 24, noNaN: true }),
  internalR: fc.oneof(fc.constant(0), fc.double({ min: 0.1, max: 10, noNaN: true })),
  closed: fc.boolean(),
});

function toSpec(n1: number, n2: number, p: EdgeProps): NetSpec {
  switch (p.kind) {
    case 'battery':
      return { kind: 'battery', n1, n2, emf: p.emf, internalR: p.internalR };
    case 'resistor':
    case 'bulb':
      return { kind: p.kind, n1, n2, resistance: p.resistance };
    case 'switch':
      return { kind: 'switch', n1, n2, closed: p.closed };
    default:
      return { kind: p.kind, n1, n2 };
  }
}

const isZeroOhm = (s: NetSpec) =>
  s.kind === 'wire' || s.kind === 'ammeter' || (s.kind === 'switch' && s.closed);

/**
 * 讓電路「合法」：0 Ω 元件縮合之後，理想電池不可形成自環或迴路
 * （否則電流無法決定）。違反者改為有內電阻的電池。
 */
export function legalize(nodeCount: number, specs: readonly NetSpec[]): NetSpec[] {
  const contracted = new UnionFind(nodeCount);
  for (const s of specs) if (isZeroOhm(s)) contracted.union(s.n1, s.n2);
  const idealForest = new UnionFind(nodeCount);
  return specs.map((s) => {
    if (s.kind !== 'battery' || (s.internalR ?? 0) > 0) return s;
    const ra = contracted.find(s.n1);
    const rb = contracted.find(s.n2);
    if (ra !== rb && idealForest.union(ra, rb)) return s;
    return { ...s, internalR: 1 };
  });
}

/** 隨機合法電路：先以隨機生成樹保證連通，再加上額外的邊形成迴路。 */
export const legalNetlistArb: fc.Arbitrary<NetSpec[]> = fc
  .integer({ min: 2, max: 10 })
  .chain((n) =>
    fc.record({
      n: fc.constant(n),
      tree: fc.array(fc.tuple(fc.nat(), edgePropsArb), { minLength: n - 1, maxLength: n - 1 }),
      extra: fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1), edgePropsArb), { maxLength: 8 }),
    }),
  )
  .map(({ n, tree, extra }) => {
    const specs = [
      ...tree.map(([pick, p], j) => toSpec(j + 1, pick % (j + 1), p)),
      ...extra.map(([n1, n2, p]) => toSpec(n1, n2, p)),
    ];
    return legalize(n, specs);
  });
