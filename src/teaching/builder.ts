import type { Circuit, CircuitElement, Point } from '../model/types';

/** 元件方向：由端點 a 指向 b（電池 b 端為正極）。 */
export type Direction = 'right' | 'left' | 'down' | 'up';

function endpoints(cx: number, cy: number, dir: Direction): { a: Point; b: Point } {
  switch (dir) {
    case 'right':
      return { a: { x: cx - 1, y: cy }, b: { x: cx + 1, y: cy } };
    case 'left':
      return { a: { x: cx + 1, y: cy }, b: { x: cx - 1, y: cy } };
    case 'down':
      return { a: { x: cx, y: cy - 1 }, b: { x: cx, y: cy + 1 } };
    case 'up':
      return { a: { x: cx, y: cy + 1 }, b: { x: cx, y: cy - 1 } };
  }
}

/** 撰寫範例電路用的小工具：以中點與方向放置元件，以折線畫導線。 */
export class CircuitBuilder {
  private readonly elements: CircuitElement[] = [];

  private nextId(): string {
    return `e${this.elements.length + 1}`;
  }

  battery(cx: number, cy: number, dir: Direction, emf: number, internalR = 0): this {
    this.elements.push({
      kind: 'battery',
      id: this.nextId(),
      ...endpoints(cx, cy, dir),
      emf,
      internalR,
    });
    return this;
  }

  resistor(cx: number, cy: number, dir: Direction, resistance: number): this {
    this.elements.push({
      kind: 'resistor',
      id: this.nextId(),
      ...endpoints(cx, cy, dir),
      resistance,
    });
    return this;
  }

  bulb(cx: number, cy: number, dir: Direction, resistance: number): this {
    this.elements.push({ kind: 'bulb', id: this.nextId(), ...endpoints(cx, cy, dir), resistance });
    return this;
  }

  switch(cx: number, cy: number, dir: Direction, closed: boolean): this {
    this.elements.push({ kind: 'switch', id: this.nextId(), ...endpoints(cx, cy, dir), closed });
    return this;
  }

  ammeter(cx: number, cy: number, dir: Direction): this {
    this.elements.push({ kind: 'ammeter', id: this.nextId(), ...endpoints(cx, cy, dir) });
    return this;
  }

  voltmeter(cx: number, cy: number, dir: Direction): this {
    this.elements.push({ kind: 'voltmeter', id: this.nextId(), ...endpoints(cx, cy, dir) });
    return this;
  }

  /** 依序連接各點的導線（每一段一條導線） */
  wire(...points: [number, number][]): this {
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1] as [number, number];
      const [x2, y2] = points[i] as [number, number];
      this.elements.push({
        kind: 'wire',
        id: this.nextId(),
        a: { x: x1, y: y1 },
        b: { x: x2, y: y2 },
      });
    }
    return this;
  }

  build(): Circuit {
    return { version: 1, elements: this.elements.slice() };
  }
}
