import type { Circuit, CircuitElement } from '../model/types';

/**
 * 效能量測用的大型電路：11 × 10 個節點的網格，相鄰節點以長度 2 的元件直接相連，
 * 共 199 條邊，再加上網格外側的電池 = 200 個元件（另有 2 條導線把電池接進網格），
 * 全部屬於同一個連通分量（最壞情況）。
 */
export function benchmarkCircuit(): Circuit {
  const columns = 11;
  const rows = 10;
  const origin = { x: 8, y: 6 };
  const node = (i: number, j: number) => ({ x: origin.x + 2 * i, y: origin.y + 2 * j });
  const left = { x: origin.x - 2, y: origin.y };
  const elements: CircuitElement[] = [
    {
      kind: 'battery',
      id: 'e1',
      a: { x: left.x, y: left.y + 2 },
      b: left,
      emf: 12,
      internalR: 0.5,
    },
    { kind: 'wire', id: 'e2', a: left, b: node(0, 0) },
    { kind: 'wire', id: 'e3', a: { x: left.x, y: left.y + 2 }, b: node(0, 1) },
  ];
  let k = 0;
  const add = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    k++;
    const id = `e${elements.length + 1}`;
    // 依序混合各種元件；電流計與電壓計穿插其中
    if (k % 23 === 0) elements.push({ kind: 'ammeter', id, a, b });
    else if (k % 29 === 0) elements.push({ kind: 'voltmeter', id, a, b });
    else if (k % 31 === 0) elements.push({ kind: 'switch', id, a, b, closed: true });
    else if (k % 5 === 0) elements.push({ kind: 'bulb', id, a, b, resistance: 20 + (k % 7) });
    else elements.push({ kind: 'resistor', id, a, b, resistance: 10 + (k % 13) });
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      if (i + 1 < columns) add(node(i, j), node(i + 1, j));
      if (j + 1 < rows) add(node(i, j), node(i, j + 1));
    }
  }
  return { version: 1, elements };
}
