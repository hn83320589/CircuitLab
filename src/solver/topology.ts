import type { CircuitElement } from '../model/types';
import { diagnostic, type Diagnostic } from './diagnostics';
import { supernodesOf, type Netlist } from './netlist';
import { UnionFind } from './unionFind';

export interface SourceMember {
  readonly element: number;
  /** +1：與代表電池同向；−1：反向 */
  readonly sign: 1 | -1;
}

/** 一條 MNA 電壓源支路；並聯且電動勢一致的理想電池會合併成同一組。 */
export interface SourceGroup {
  readonly sa: number;
  readonly sb: number;
  readonly emf: number;
  readonly internalR: number;
  readonly members: SourceMember[];
}

export interface SourceAnalysis {
  readonly groupOfElement: ReadonlyMap<number, SourceGroup>;
  readonly diagnostics: Diagnostic[];
  /** 所在連通分量無法求解的超節點 */
  readonly failedSupernodes: number[];
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** 在超節點內，沿 0 Ω 元件找出 from → to 的一條路徑（回傳元件索引）。 */
function zeroOhmPath(net: Netlist, from: number, to: number): number[] {
  const adjacency = new Map<number, { element: number; next: number }[]>();
  net.roles.forEach((role, i) => {
    if (role !== 'zeroOhm') return;
    const pa = net.pointA[i] as number;
    const pb = net.pointB[i] as number;
    adjacency.set(pa, [...(adjacency.get(pa) ?? []), { element: i, next: pb }]);
    adjacency.set(pb, [...(adjacency.get(pb) ?? []), { element: i, next: pa }]);
  });
  const via = new Map<number, { element: number; prev: number }>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const p = queue.shift() as number;
    if (p === to) break;
    for (const { element, next } of adjacency.get(p) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      via.set(next, { element, prev: p });
      queue.push(next);
    }
  }
  const path: number[] = [];
  for (let p = to; via.has(p); p = (via.get(p) as { prev: number }).prev) {
    path.push((via.get(p) as { element: number }).element);
  }
  return path.reverse();
}

/**
 * 檢查電池的接法，並把並聯且電動勢一致的理想電池合併成一組：
 * - 理想電池（r = 0）兩極落在同一超節點 → 短路，無法計算
 * - 有內電阻的電池被短路 → 可計算，但提出警告
 * - 理想電池形成迴路 → 依迴路電動勢是否一致，判為矛盾或電流不確定
 */
export function analyzeSources(elements: readonly CircuitElement[], net: Netlist): SourceAnalysis {
  const groupOfElement = new Map<number, SourceGroup>();
  const diagnostics: Diagnostic[] = [];
  const failedSupernodes: number[] = [];
  const idsOf = (indices: readonly number[]) =>
    indices.map((i) => (elements[i] as CircuitElement).id);

  const idealGroups = new Map<string, SourceGroup>();
  const idealOrder: SourceGroup[] = [];

  elements.forEach((el, i) => {
    if (el.kind !== 'battery' || net.roles[i] !== 'source') return;
    const [sa, sb] = supernodesOf(net, i);
    const single: SourceGroup = {
      sa,
      sb,
      emf: el.emf,
      internalR: el.internalR,
      members: [{ element: i, sign: 1 }],
    };

    if (sa === sb) {
      const path = zeroOhmPath(net, net.pointA[i] as number, net.pointB[i] as number);
      if (el.internalR > 0) {
        diagnostics.push(diagnostic('SHORT_CIRCUIT_WARNING', idsOf([i, ...path])));
        groupOfElement.set(i, single);
      } else {
        const viaAmmeter = path.some((p) => elements[p]?.kind === 'ammeter');
        const code = viaAmmeter ? 'AMMETER_SHORTS_BATTERY' : 'BATTERY_SHORTED';
        diagnostics.push(diagnostic(code, idsOf([i, ...path])));
        failedSupernodes.push(sa);
      }
      return;
    }

    if (el.internalR > 0) {
      groupOfElement.set(i, single);
      return;
    }

    const key = sa < sb ? `${sa},${sb}` : `${sb},${sa}`;
    const group = idealGroups.get(key);
    if (group) {
      group.members.push({ element: i, sign: group.sa === sa ? 1 : -1 });
      groupOfElement.set(i, group);
    } else {
      idealGroups.set(key, single);
      idealOrder.push(single);
      groupOfElement.set(i, single);
    }
  });

  // 同一對超節點上的理想電池，電動勢必須一致
  const consistent = idealOrder.filter((group) => {
    const ok = group.members.every((m) => {
      const emf = (elements[m.element] as { emf: number }).emf;
      return nearlyEqual(m.sign * emf, group.emf);
    });
    if (!ok) {
      diagnostics.push(
        diagnostic('CONFLICTING_SOURCES', idsOf(group.members.map((m) => m.element))),
      );
      failedSupernodes.push(group.sa);
    }
    return ok;
  });

  // 理想電池組在超節點間構成生成森林；新邊兩端已連通即形成迴路
  const uf = new UnionFind(net.supernodeCount);
  const forest = new Map<number, { next: number; rise: number; group: SourceGroup }[]>();
  const link = (from: number, next: number, rise: number, group: SourceGroup) => {
    forest.set(from, [...(forest.get(from) ?? []), { next, rise, group }]);
  };
  for (const group of consistent) {
    if (uf.union(group.sa, group.sb)) {
      link(group.sa, group.sb, group.emf, group);
      link(group.sb, group.sa, -group.emf, group);
      continue;
    }
    // 在森林中找 sa → sb 的路徑，累加電位上升量
    const via = new Map<number, { prev: number; rise: number; group: SourceGroup }>();
    const queue = [group.sa];
    const seen = new Set([group.sa]);
    while (queue.length > 0) {
      const s = queue.shift() as number;
      for (const edge of forest.get(s) ?? []) {
        if (seen.has(edge.next)) continue;
        seen.add(edge.next);
        via.set(edge.next, { prev: s, rise: edge.rise, group: edge.group });
        queue.push(edge.next);
      }
    }
    let rise = 0;
    const loopMembers = group.members.map((m) => m.element);
    for (let s = group.sb; via.has(s);) {
      const step = via.get(s) as { prev: number; rise: number; group: SourceGroup };
      rise += step.rise;
      loopMembers.push(...step.group.members.map((m) => m.element));
      s = step.prev;
    }
    const code = nearlyEqual(rise, group.emf) ? 'SOURCE_LOOP' : 'CONFLICTING_SOURCES';
    diagnostics.push(diagnostic(code, idsOf(loopMembers)));
    failedSupernodes.push(group.sa);
  }

  return { groupOfElement, diagnostics, failedSupernodes };
}

/**
 * 反覆移除「有端點所在格點只有它自己」的元件（剝葉子），
 * 找出所有懸空、不可能有電流通過的元件。
 */
export function findDangling(net: Netlist): number[] {
  const degree = Int32Array.from(net.terminalCount);
  const elementsAt = Array.from({ length: net.pointCount }, () => [] as number[]);
  net.roles.forEach((_, i) => {
    elementsAt[net.pointA[i] as number]?.push(i);
    elementsAt[net.pointB[i] as number]?.push(i);
  });
  const removed = new Uint8Array(net.roles.length);
  const queue: number[] = [];
  for (let p = 0; p < net.pointCount; p++) if (degree[p] === 1) queue.push(p);

  const dangling: number[] = [];
  while (queue.length > 0) {
    const p = queue.shift() as number;
    const element = elementsAt[p]?.find((i) => !removed[i]);
    if (element === undefined) continue;
    removed[element] = 1;
    dangling.push(element);
    for (const q of [net.pointA[element] as number, net.pointB[element] as number]) {
      degree[q] = (degree[q] as number) - 1;
      if (degree[q] === 1) queue.push(q);
    }
  }
  return dangling.sort((x, y) => x - y);
}
