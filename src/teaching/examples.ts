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

const parallel = new CircuitBuilder()
  .battery(10, 14, 'up', 6)
  .wire([10, 13], [10, 8], [13, 8])
  .ammeter(14, 8, 'right')
  .wire([15, 8], [20, 8], [20, 11])
  .resistor(20, 12, 'down', 3)
  .wire([20, 8], [28, 8], [28, 11])
  .resistor(28, 12, 'down', 6)
  .wire([20, 13], [20, 18])
  .wire([28, 13], [28, 18], [20, 18], [10, 18], [10, 15])
  .build();

const mixed = new CircuitBuilder()
  .battery(8, 16, 'up', 12)
  .wire([8, 15], [8, 10], [13, 10])
  .resistor(14, 10, 'right', 4)
  .wire([15, 10], [20, 10], [20, 13])
  .resistor(20, 14, 'down', 6)
  .wire([20, 10], [26, 10], [26, 13])
  .resistor(26, 14, 'down', 12)
  .wire([20, 15], [20, 20])
  .wire([26, 15], [26, 20], [20, 20], [8, 20], [8, 17])
  .build();

/** 惠斯登電橋：左臂 R1、R2，右臂 R3、R4，中間以電流計跨接 */
function wheatstone(r1: number, r2: number, r3: number, r4: number): Circuit {
  return new CircuitBuilder()
    .battery(10, 12, 'up', 10)
    .wire([10, 11], [10, 6], [20, 6])
    .wire([20, 9], [20, 6], [32, 6], [32, 9])
    .resistor(20, 10, 'down', r1)
    .wire([20, 11], [20, 13], [20, 15])
    .resistor(20, 16, 'down', r2)
    .resistor(32, 10, 'down', r3)
    .wire([32, 11], [32, 13], [32, 15])
    .resistor(32, 16, 'down', r4)
    .wire([20, 13], [25, 13])
    .ammeter(26, 13, 'right')
    .wire([27, 13], [32, 13])
    .wire([20, 17], [20, 20], [32, 20], [32, 17])
    .wire([10, 13], [10, 20], [20, 20])
    .build();
}

const internalResistance = new CircuitBuilder()
  .battery(10, 14, 'up', 9, 1)
  .voltmeter(6, 14, 'up')
  .wire([6, 13], [6, 10], [10, 10])
  .wire([10, 13], [10, 10], [16, 10])
  .switch(17, 10, 'right', false)
  .wire([18, 10], [24, 10], [24, 13])
  .bulb(24, 14, 'down', 8)
  .wire([24, 15], [24, 18], [10, 18])
  .wire([6, 15], [6, 18], [10, 18])
  .wire([10, 15], [10, 18])
  .build();

const comparison = new CircuitBuilder()
  // 左：兩個燈泡串聯
  .battery(6, 16, 'up', 6)
  .wire([6, 15], [6, 10], [11, 10])
  .bulb(12, 10, 'right', 10)
  .wire([13, 10], [17, 10])
  .bulb(18, 10, 'right', 10)
  .wire([19, 10], [22, 10], [22, 22], [6, 22], [6, 17])
  // 右：兩個燈泡並聯
  .battery(34, 16, 'up', 6)
  .wire([34, 15], [34, 10], [42, 10], [42, 13])
  .bulb(42, 14, 'down', 10)
  .wire([42, 10], [50, 10], [50, 13])
  .bulb(50, 14, 'down', 10)
  .wire([42, 15], [42, 22])
  .wire([50, 15], [50, 22], [42, 22], [34, 22], [34, 17])
  .build();

const meters = new CircuitBuilder()
  .battery(8, 16, 'up', 6)
  .wire([8, 15], [8, 10], [11, 10])
  .ammeter(12, 10, 'right')
  .wire([13, 10], [17, 10])
  .resistor(18, 10, 'right', 10)
  .wire([19, 10], [25, 10], [25, 14])
  .bulb(25, 15, 'down', 20)
  .wire([25, 16], [25, 20], [8, 20], [8, 17])
  .voltmeter(30, 15, 'down')
  .wire([25, 14], [30, 14])
  .wire([25, 16], [30, 16])
  .build();

const switchPrediction = new CircuitBuilder()
  .battery(8, 16, 'up', 6, 1)
  .wire([8, 15], [8, 10], [18, 10])
  .bulb(18, 14, 'down', 10)
  .wire([18, 10], [18, 13])
  .wire([18, 15], [18, 20])
  .wire([18, 10], [28, 10], [28, 11])
  .switch(28, 12, 'down', false)
  .wire([28, 13], [28, 15])
  .bulb(28, 16, 'down', 10)
  .wire([28, 17], [28, 20], [18, 20], [8, 20], [8, 17])
  .build();

const shortCircuit = new CircuitBuilder()
  .battery(8, 16, 'up', 6)
  .wire([8, 15], [8, 10], [18, 10])
  .bulb(18, 14, 'down', 10)
  .wire([18, 10], [18, 13])
  .wire([18, 15], [18, 20])
  .wire([18, 10], [26, 10], [26, 13])
  .switch(26, 14, 'down', false)
  .wire([26, 15], [26, 20], [18, 20], [8, 20], [8, 17])
  .build();

export const EXAMPLES: readonly Example[] = [
  {
    id: 'series',
    title: '1. 串聯電路',
    description: '12 V 電池串聯 4 Ω 與 8 Ω：電流處處相等，電壓依電阻比例分配（4 V 與 8 V）。',
    circuit: series,
  },
  {
    id: 'parallel',
    title: '2. 並聯電路',
    description: '6 V 電池接 3 Ω 與 6 Ω 並聯：兩支路電壓相同，電流 2 A 與 1 A，總電流 3 A。',
    circuit: parallel,
  },
  {
    id: 'mixed',
    title: '3. 串並聯混合',
    description: '4 Ω 串聯（6 Ω ∥ 12 Ω）：並聯部分等效 4 Ω，總電流 1.5 A。',
    circuit: mixed,
  },
  {
    id: 'bridge-balanced',
    title: '4. 惠斯登電橋（平衡）',
    description: 'R1 : R2 = R3 : R4 時電橋平衡，中間的電流計讀數為 0。',
    circuit: wheatstone(100, 200, 150, 300),
  },
  {
    id: 'bridge-unbalanced',
    title: '5. 惠斯登電橋（不平衡）',
    description: '比例不相等時，電流會從電位高的一側流過中間的電流計。',
    circuit: wheatstone(100, 200, 200, 100),
  },
  {
    id: 'internal-resistance',
    title: '6. 電池內電阻與端電壓',
    description:
      '9 V、內電阻 1 Ω 的電池：開關斷開時電壓計讀 9 V；閉合接上 8 Ω 燈泡後端電壓降為 8 V。',
    circuit: internalResistance,
  },
  {
    id: 'comparison',
    title: '7. 串聯與並聯對照',
    description: '同樣的電池與燈泡：左邊串聯、右邊並聯。比比看哪一組的燈泡比較亮？',
    circuit: comparison,
  },
  {
    id: 'meters',
    title: '8. 電流計與電壓計的接法',
    description: '電流計要串聯在電路中，電壓計要並聯在要量測的元件兩端。',
    circuit: meters,
  },
  {
    id: 'switch-prediction',
    title: '9. 開關與並聯支路（預測練習）',
    description:
      '電池有 1 Ω 內電阻。開啟「預測模式」，選左邊的燈泡與開關，猜猜閉合開關後它會變亮、變暗還是不變？',
    circuit: switchPrediction,
  },
  {
    id: 'short-circuit',
    title: '10. 短路示範',
    description: '閉合開關後，電池兩端被導線直接接通，形成短路。看看會出現什麼提示。',
    circuit: shortCircuit,
  },
];
