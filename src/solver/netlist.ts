import { pointKey } from '../model/geometry';
import type { CircuitElement } from '../model/types';
import { UnionFind } from './unionFind';

/**
 * 元件在求解時扮演的角色：
 * - zeroOhm：導線、電流計、閉合開關（以及 0 V、0 Ω 的電池），縮合進超節點
 * - resistive：電阻、燈泡
 * - source：電池（電壓源串聯內電阻）
 * - open：電壓計、斷開的開關，不導電
 */
export type ElementRole = 'zeroOhm' | 'resistive' | 'source' | 'open';

export function elementRole(el: CircuitElement): ElementRole {
  switch (el.kind) {
    case 'wire':
    case 'ammeter':
      return 'zeroOhm';
    case 'switch':
      return el.closed ? 'zeroOhm' : 'open';
    case 'voltmeter':
      return 'open';
    case 'resistor':
    case 'bulb':
      return 'resistive';
    case 'battery':
      return el.emf === 0 && el.internalR === 0 ? 'zeroOhm' : 'source';
  }
}

export interface Netlist {
  readonly roles: readonly ElementRole[];
  /** 元件索引 → 端點 a／b 的格點索引 */
  readonly pointA: Int32Array;
  readonly pointB: Int32Array;
  readonly pointCount: number;
  /** 每個格點上有幾個元件端點 */
  readonly terminalCount: Int32Array;
  readonly supernodeOfPoint: Int32Array;
  readonly supernodeCount: number;
}

/** 端點落在同一格點即相連；再把 0 Ω 元件兩端縮合成同一個超節點。 */
export function buildNetlist(elements: readonly CircuitElement[]): Netlist {
  const pointIndex = new Map<string, number>();
  const indexOf = (key: string) => {
    let index = pointIndex.get(key);
    if (index === undefined) {
      index = pointIndex.size;
      pointIndex.set(key, index);
    }
    return index;
  };

  const pointA = new Int32Array(elements.length);
  const pointB = new Int32Array(elements.length);
  elements.forEach((el, i) => {
    pointA[i] = indexOf(pointKey(el.a));
    pointB[i] = indexOf(pointKey(el.b));
  });
  const pointCount = pointIndex.size;

  const terminalCount = new Int32Array(pointCount);
  const roles = elements.map(elementRole);
  const uf = new UnionFind(pointCount);
  elements.forEach((_, i) => {
    const pa = pointA[i] as number;
    const pb = pointB[i] as number;
    terminalCount[pa] = (terminalCount[pa] as number) + 1;
    terminalCount[pb] = (terminalCount[pb] as number) + 1;
    if (roles[i] === 'zeroOhm') uf.union(pa, pb);
  });

  const supernodeOfPoint = new Int32Array(pointCount);
  const supernodeOfRoot = new Map<number, number>();
  for (let p = 0; p < pointCount; p++) {
    const root = uf.find(p);
    let s = supernodeOfRoot.get(root);
    if (s === undefined) {
      s = supernodeOfRoot.size;
      supernodeOfRoot.set(root, s);
    }
    supernodeOfPoint[p] = s;
  }

  return {
    roles,
    pointA,
    pointB,
    pointCount,
    terminalCount,
    supernodeOfPoint,
    supernodeCount: supernodeOfRoot.size,
  };
}

export function supernodesOf(net: Netlist, elementIndex: number): [number, number] {
  return [
    net.supernodeOfPoint[net.pointA[elementIndex] as number] as number,
    net.supernodeOfPoint[net.pointB[elementIndex] as number] as number,
  ];
}
