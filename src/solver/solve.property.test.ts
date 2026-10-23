import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { solve } from './solve';
import { allFinite, maxKclResidual, powerBalance } from './testing/invariants';
import { layoutNetlist, mergeCircuits, type NetSpec } from './testing/layout';
import { legalNetlistArb } from './testing/randomCircuit';

/** 固定亂數種子，讓失敗可以重現 */
const SEED = 20261023;
const RUNS = 1000;
const options = { seed: SEED, numRuns: RUNS };

describe(`性質測試（${RUNS} 個隨機合法電路，seed = ${SEED}）`, () => {
  it('沒有 error，所有數值皆為有限值', () => {
    fc.assert(
      fc.property(legalNetlistArb, (specs) => {
        const result = solve(layoutNetlist(specs));
        expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(allFinite(result)).toBe(true);
      }),
      options,
    );
  });

  it('每個格點流入與流出的電流加總絕對值小於 1e-9 A', () => {
    fc.assert(
      fc.property(legalNetlistArb, (specs) => {
        const circuit = layoutNetlist(specs);
        expect(maxKclResidual(circuit, solve(circuit))).toBeLessThan(1e-9);
      }),
      options,
    );
  });

  it('電源提供的功率等於所有元件消耗的功率（相對誤差小於 1e-6）', () => {
    fc.assert(
      fc.property(legalNetlistArb, (specs) => {
        const circuit = layoutNetlist(specs);
        const { supplied, consumed } = powerBalance(circuit, solve(circuit));
        const scale = Math.max(Math.abs(supplied), Math.abs(consumed));
        if (scale < 1e-12) return; // 沒有電流的電路
        expect(Math.abs(supplied - consumed) / scale).toBeLessThan(1e-6);
      }),
      options,
    );
  });

  it('兩組電路放在同一張畫布，結果與分開求解完全相同', () => {
    fc.assert(
      fc.property(legalNetlistArb, legalNetlistArb, (specsA, specsB) => {
        const a = layoutNetlist(specsA, { idPrefix: 'a' });
        const b = layoutNetlist(specsB, { idPrefix: 'b', offset: { x: 30, y: 0 } });
        const together = solve(mergeCircuits(a, b)).elements;
        const alone = new Map([...solve(a).elements, ...solve(b).elements]);
        expect(together).toEqual(alone);
      }),
      options,
    );
  });

  it('接上電壓計不改變任何元件的電流', () => {
    const extraVoltmeters = fc.array(fc.tuple(fc.nat(9), fc.nat(9)), {
      minLength: 1,
      maxLength: 4,
    });
    fc.assert(
      fc.property(legalNetlistArb, extraVoltmeters, (specs, pairs) => {
        const nodeCount = 1 + Math.max(...specs.flatMap((s) => [s.n1, s.n2]));
        const meters: NetSpec[] = pairs.map(([n1, n2], k) => ({
          kind: 'voltmeter',
          id: `vm${k}`,
          n1: n1 % nodeCount,
          n2: n2 % nodeCount,
        }));
        const without = solve(layoutNetlist(specs)).elements;
        const withMeters = solve(layoutNetlist([...specs, ...meters])).elements;
        for (const [id, r] of without) {
          if (!r || !id.match(/^e\d+$/)) continue;
          const other = withMeters.get(id);
          expect(Math.abs((other?.current ?? NaN) - r.current)).toBeLessThan(
            1e-9 * Math.max(1, Math.abs(r.current)),
          );
        }
      }),
      options,
    );
  });

  it('相同電路求解兩次，結果位元級相同（Undo/存檔還原的基礎）', () => {
    fc.assert(
      fc.property(legalNetlistArb, (specs) => {
        const circuit = layoutNetlist(specs);
        const copy = JSON.parse(JSON.stringify(circuit)) as typeof circuit;
        expect(solve(copy)).toEqual(solve(circuit));
      }),
      options,
    );
  });
});
