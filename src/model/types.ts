/** 格點座標（整數）。 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export type ElementKind =
  'battery' | 'resistor' | 'bulb' | 'switch' | 'wire' | 'ammeter' | 'voltmeter';

interface ElementBase {
  readonly id: string;
  readonly a: Point;
  /** 電池的 b 端為正極。 */
  readonly b: Point;
}

export interface Battery extends ElementBase {
  readonly kind: 'battery';
  readonly emf: number;
  readonly internalR: number;
}

export interface Resistor extends ElementBase {
  readonly kind: 'resistor';
  readonly resistance: number;
}

/** 燈泡視為固定電阻。 */
export interface Bulb extends ElementBase {
  readonly kind: 'bulb';
  readonly resistance: number;
}

export interface Switch extends ElementBase {
  readonly kind: 'switch';
  readonly closed: boolean;
}

export interface Wire extends ElementBase {
  readonly kind: 'wire';
}

/** 理想電流計，內阻為 0。 */
export interface Ammeter extends ElementBase {
  readonly kind: 'ammeter';
}

/** 理想電壓計，內阻無限大。 */
export interface Voltmeter extends ElementBase {
  readonly kind: 'voltmeter';
}

export type CircuitElement = Battery | Resistor | Bulb | Switch | Wire | Ammeter | Voltmeter;

export interface Circuit {
  readonly version: 1;
  readonly elements: readonly CircuitElement[];
}
