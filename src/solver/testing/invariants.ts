import { pointKey } from '../../model/geometry';
import type { Circuit } from '../../model/types';
import type { SolveResult } from '../solve';

/** 每個格點「流出電流總和」的最大絕對值（KCL 殘差）。只計入有數值的元件。 */
export function maxKclResidual(circuit: Circuit, result: SolveResult): number {
  const net = new Map<string, number>();
  for (const el of circuit.elements) {
    const r = result.elements.get(el.id);
    if (!r) continue;
    net.set(pointKey(el.a), (net.get(pointKey(el.a)) ?? 0) + r.current);
    net.set(pointKey(el.b), (net.get(pointKey(el.b)) ?? 0) - r.current);
  }
  return Math.max(0, ...[...net.values()].map(Math.abs));
}

/** 電源提供的功率 Σ E·I 與元件消耗的功率 Σ I²R + Σ I²r。 */
export function powerBalance(
  circuit: Circuit,
  result: SolveResult,
): { supplied: number; consumed: number } {
  let supplied = 0;
  let consumed = 0;
  for (const el of circuit.elements) {
    const r = result.elements.get(el.id);
    if (!r) continue;
    if (el.kind === 'battery') {
      supplied += el.emf * r.current;
      consumed += r.current * r.current * el.internalR;
    } else if (el.kind === 'resistor' || el.kind === 'bulb') {
      consumed += r.current * r.current * el.resistance;
    }
  }
  return { supplied, consumed };
}

export function allFinite(result: SolveResult): boolean {
  return [...result.elements.values()].every(
    (r) => r === null || [r.current, r.voltage, r.power].every(Number.isFinite),
  );
}
