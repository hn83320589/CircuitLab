import type { Circuit, CircuitElement } from '../model/types';
import { diagnostic, type Diagnostic } from './diagnostics';
import { solveMna, type Branch } from './mna';
import { buildNetlist, supernodesOf, type Netlist } from './netlist';
import { UnionFind } from './unionFind';
import { distributeZeroOhmCurrents, type ZeroOhmEdge } from './zeroOhmFlow';

export interface ElementResult {
  /** 元件內部由端點 a 流向 b 的電流（A） */
  readonly current: number;
  /** V(a) − V(b)（V） */
  readonly voltage: number;
  /** 吸收功率 = voltage × current（W）；電池供電時為負值 */
  readonly power: number;
}

export interface SolveResult {
  /** null 代表無法得到數值（所在電路有錯誤接法，或無法量測） */
  readonly elements: ReadonlyMap<string, ElementResult | null>;
  readonly diagnostics: readonly Diagnostic[];
}

interface Component {
  /** 依導電元件出現順序排列；第一個為接地點 */
  readonly supernodes: number[];
  /** 導電元件（電阻、燈泡、電池）的索引 */
  readonly conductive: number[];
}

/** 以導電元件把超節點分成連通分量；每個分量各自建立方程組求解。 */
function findComponents(net: Netlist): { componentOf: Int32Array; components: Component[] } {
  const isConductive = (i: number) => net.roles[i] === 'resistive' || net.roles[i] === 'source';
  const uf = new UnionFind(net.supernodeCount);
  net.roles.forEach((_, i) => {
    if (isConductive(i)) uf.union(...supernodesOf(net, i));
  });

  const componentOf = new Int32Array(net.supernodeCount).fill(-1);
  const componentOfRoot = new Map<number, number>();
  const components: Component[] = [];
  const assign = (s: number) => {
    if (componentOf[s] !== -1) return components[componentOf[s] as number] as Component;
    const root = uf.find(s);
    let id = componentOfRoot.get(root);
    if (id === undefined) {
      id = components.length;
      componentOfRoot.set(root, id);
      components.push({ supernodes: [], conductive: [] });
    }
    componentOf[s] = id;
    const component = components[id] as Component;
    component.supernodes.push(s);
    return component;
  };

  net.roles.forEach((_, i) => {
    if (!isConductive(i)) return;
    const [sa, sb] = supernodesOf(net, i);
    assign(sa);
    assign(sb).conductive.push(i);
  });
  for (let s = 0; s < net.supernodeCount; s++) assign(s);
  return { componentOf, components };
}

function toBranch(el: CircuitElement, sa: number, sb: number): Branch {
  if (el.kind === 'battery') {
    return { kind: 'source', sa, sb, emf: el.emf, internalR: el.internalR };
  }
  if (el.kind === 'resistor' || el.kind === 'bulb') {
    return { kind: 'resistive', sa, sb, conductance: 1 / el.resistance };
  }
  throw new Error(`${el.kind} 不是導電元件`);
}

export function solve(circuit: Circuit): SolveResult {
  const elements = circuit.elements;
  const net = buildNetlist(elements);
  const { componentOf, components } = findComponents(net);
  const failed = new Set<number>();
  const voltage = new Float64Array(net.supernodeCount);
  const current = new Float64Array(elements.length);

  // ① 每個連通分量各自做 MNA
  components.forEach((component, id) => {
    if (component.conductive.length === 0) return;
    const branches = component.conductive.map((i) => {
      const [sa, sb] = supernodesOf(net, i);
      return toBranch(elements[i] as CircuitElement, sa, sb);
    });
    const solution = solveMna({ supernodes: component.supernodes, branches });
    if (!solution) {
      failed.add(id);
      return;
    }
    component.supernodes.forEach((s, k) => (voltage[s] = solution.voltages[k] as number));
    let sourceIndex = 0;
    component.conductive.forEach((i, k) => {
      const branch = branches[k] as Branch;
      current[i] =
        branch.kind === 'resistive'
          ? ((voltage[branch.sa] as number) - (voltage[branch.sb] as number)) * branch.conductance
          : (solution.sourceCurrents[sourceIndex++] as number);
    });
  });

  // ② 超節點內部分配 0 Ω 元件的電流
  const injection = new Float64Array(net.pointCount);
  net.roles.forEach((role, i) => {
    if (role !== 'resistive' && role !== 'source') return;
    const pa = net.pointA[i] as number;
    const pb = net.pointB[i] as number;
    injection[pa] = (injection[pa] as number) + (current[i] as number);
    injection[pb] = (injection[pb] as number) - (current[i] as number);
  });
  const pointsOfSupernode = Array.from({ length: net.supernodeCount }, () => [] as number[]);
  for (let p = 0; p < net.pointCount; p++) {
    pointsOfSupernode[net.supernodeOfPoint[p] as number]?.push(p);
  }
  const zeroOhmOfSupernode = Array.from({ length: net.supernodeCount }, () => [] as number[]);
  net.roles.forEach((role, i) => {
    if (role === 'zeroOhm') zeroOhmOfSupernode[supernodesOf(net, i)[0]]?.push(i);
  });
  zeroOhmOfSupernode.forEach((indices, s) => {
    const id = componentOf[s] as number;
    if (indices.length === 0 || failed.has(id)) return;
    const edges: ZeroOhmEdge[] = indices.map((i) => ({
      pa: net.pointA[i] as number,
      pb: net.pointB[i] as number,
    }));
    const flows = distributeZeroOhmCurrents(
      pointsOfSupernode[s] as number[],
      edges,
      (p) => injection[p] as number,
    );
    if (!flows) {
      failed.add(id);
      return;
    }
    indices.forEach((i, k) => (current[i] = flows[k] as number));
  });

  // ③ 組合每個元件的結果；任何非有限值都讓所在分量改判為錯誤
  const componentsOfElement = (i: number): [number, number] => {
    const [sa, sb] = supernodesOf(net, i);
    return [componentOf[sa] as number, componentOf[sb] as number];
  };
  const raw: (ElementResult | null)[] = elements.map((_, i) => {
    const [ca, cb] = componentsOfElement(i);
    if (ca !== cb) return null;
    const [sa, sb] = supernodesOf(net, i);
    const v = (voltage[sa] as number) - (voltage[sb] as number);
    switch (net.roles[i]) {
      case 'zeroOhm':
        return { current: current[i] as number, voltage: 0, power: 0 };
      case 'open':
        return { current: 0, voltage: v, power: 0 };
      default:
        return { current: current[i] as number, voltage: v, power: v * (current[i] as number) };
    }
  });
  raw.forEach((r, i) => {
    if (r && ![r.current, r.voltage, r.power].every(Number.isFinite)) {
      failed.add(componentsOfElement(i)[0]);
    }
  });

  const results = new Map<string, ElementResult | null>();
  const failedMembers = new Map<number, string[]>();
  elements.forEach((el, i) => {
    const [ca, cb] = componentsOfElement(i);
    const inFailed = failed.has(ca) || failed.has(cb);
    results.set(el.id, inFailed ? null : (raw[i] as ElementResult | null));
    if (inFailed && net.roles[i] !== 'open') {
      const members = failedMembers.get(ca) ?? [];
      members.push(el.id);
      failedMembers.set(ca, members);
    }
  });

  const diagnostics: Diagnostic[] = [...failedMembers.values()].map((ids) =>
    diagnostic('SINGULAR', ids),
  );
  return { elements: results, diagnostics };
}
