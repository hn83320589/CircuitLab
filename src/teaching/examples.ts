import type { Circuit } from '../model/types';
import { CircuitBuilder } from './builder';

export interface Example {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly circuit: Circuit;
}

const series = new CircuitBuilder()
  .battery(10, 14, 'up', 12)
  .wire([10, 13], [10, 8], [15, 8])
  .resistor(16, 8, 'right', 4)
  .wire([17, 8], [21, 8])
  .resistor(22, 8, 'right', 8)
  .wire([23, 8], [28, 8], [28, 20], [10, 20], [10, 15])
  .build();

export const EXAMPLES: readonly Example[] = [
  {
    id: 'series',
    title: '1. 串聯電路',
    description: '12 V 電池串聯 4 Ω 與 8 Ω：電流處處相等，電壓依電阻比例分配。',
    circuit: series,
  },
];
