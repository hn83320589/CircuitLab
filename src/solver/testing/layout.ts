import type { Battery, Circuit, CircuitElement, Point } from '../../model/types';

/** 抽象網表中的一個元件：n1 接到端點 a，n2 接到端點 b（電池 b 端為正極）。 */
export type NetSpec =
  | { kind: 'battery'; n1: number; n2: number; emf: number; internalR?: number; id?: string }
  | { kind: 'resistor' | 'bulb'; n1: number; n2: number; resistance: number; id?: string }
  | { kind: 'switch'; n1: number; n2: number; closed: boolean; id?: string }
  | { kind: 'wire' | 'ammeter' | 'voltmeter'; n1: number; n2: number; id?: string };

export interface LayoutOptions {
  /** 整個佈局的位移，用來把兩組電路放在不重疊的位置。 */
  offset?: Point;
  idPrefix?: string;
}

/**
 * 把抽象網表放到格點上：每個抽象節點對應一個「匯流格點」，
 * 每個元件放在自己的位置，再用導線把兩端拉到對應的匯流格點。
 * 導線只在端點相連，所以交叉不會造成意外連接。
 */
export function layoutNetlist(specs: readonly NetSpec[], options: LayoutOptions = {}): Circuit {
  const { offset = { x: 0, y: 0 }, idPrefix = '' } = options;
  const at = (x: number, y: number): Point => ({ x: x + offset.x, y: y + offset.y });
  const bus = (node: number) => at(0, node * 3 + 1);
  const elements: CircuitElement[] = [];

  specs.forEach((spec, j) => {
    const id = spec.id ?? `${idPrefix}e${j}`;
    const a = at(10, j * 3);
    const b = at(12, j * 3);
    elements.push(toElement(spec, id, a, b));
    elements.push({ kind: 'wire', id: `${id}-wa`, a: bus(spec.n1), b: a });
    elements.push({ kind: 'wire', id: `${id}-wb`, a: b, b: bus(spec.n2) });
  });

  return { version: 1, elements };
}

function toElement(spec: NetSpec, id: string, a: Point, b: Point): CircuitElement {
  switch (spec.kind) {
    case 'battery': {
      const battery: Battery = {
        kind: 'battery',
        id,
        a,
        b,
        emf: spec.emf,
        internalR: spec.internalR ?? 0,
      };
      return battery;
    }
    case 'resistor':
    case 'bulb':
      return { kind: spec.kind, id, a, b, resistance: spec.resistance };
    case 'switch':
      return { kind: 'switch', id, a, b, closed: spec.closed };
    default:
      return { kind: spec.kind, id, a, b };
  }
}

export function mergeCircuits(...circuits: Circuit[]): Circuit {
  return { version: 1, elements: circuits.flatMap((c) => c.elements) };
}
