# 第 5 章　程式內容導讀

> **本章目標**
>
> - 掌握專案結構與建議的閱讀順序
> - 學會用 TypeScript 的型別表達領域規則
> - 理解 reducer、不可變更新與歷史紀錄的實作
> - 理解 SVG 互動、效能最佳化、輸入驗證的寫法

本章逐一閱讀各模組的程式碼。核心演算法（`solver/`）的細節放在第 6 章，本章只看它的整體結構。

## 5.1 專案結構與閱讀順序

```
src/
├── model/          ← ① 從這裡開始：資料長什麼樣子
│   ├── types.ts
│   ├── geometry.ts
│   └── elements.ts
├── solver/         ← ③ 核心演算法（第 6 章）
│   ├── unionFind.ts
│   ├── netlist.ts
│   ├── topology.ts
│   ├── mna.ts
│   ├── linalg.ts
│   ├── zeroOhmFlow.ts
│   ├── diagnostics.ts
│   ├── solve.ts
│   └── testing/    ← 測試用的工具（電路產生器、不變量檢查）
├── editor/         ← ② 資料怎麼被改變
│   └── reducer.ts
├── teaching/       ← ④ 教學功能
├── io/             ← ⑤ 資料怎麼進出系統
├── perf/
├── ui/             ← ⑥ 最後才看畫面
└── format.ts
```

建議的閱讀順序是**由內而外**：先看資料結構，再看資料怎麼被改變，再看資料怎麼被計算，最後看資料怎麼被呈現。這個順序和依賴方向（第 3.2 節）一致，讀每個檔案時，它依賴的東西都已經讀過了。

## 5.2 用型別表達領域規則（`model/types.ts`）

```ts
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

export interface Switch extends ElementBase {
  readonly kind: 'switch';
  readonly closed: boolean;
}

// ……其餘 5 種

export type CircuitElement = Battery | Resistor | Bulb | Switch | Wire | Ammeter | Voltmeter;
```

這裡用了 TypeScript 的**判別聯合型別**（discriminated union）。`kind` 欄位是「判別子」，TypeScript 會根據它自動縮小型別：

```ts
function describe(el: CircuitElement) {
  if (el.kind === 'battery') {
    return el.emf; // ✅ 這裡 TypeScript 知道 el 是 Battery
  }
  return el.emf; // ❌ 編譯錯誤：其他元件沒有 emf
}
```

這帶來三個好處：

1. **不可能出現「開關有電阻值」這種不合理的資料**，型別系統直接禁止。
2. **窮舉檢查**：在 `switch (el.kind)` 中漏掉某種元件，TypeScript 會報錯（見 `netlist.ts` 的 `elementRole`）。以後新增第 8 種元件時，編譯器會列出所有需要修改的地方。
3. 程式碼本身就是文件。

其他值得注意的細節：

- **全部欄位都是 `readonly`**：在型別層級禁止直接修改，強迫使用不可變更新（第 5.4 節）。
- **取名 `CircuitElement` 而不是 `Element`**：瀏覽器已經有一個全域型別叫 `Element`（DOM 元素），同名會造成混淆。

### 幾何運算（`model/elements.ts`）

```ts
export function rotate90<T extends CircuitElement>(el: T): T {
  const cx = Math.round((el.a.x + el.b.x) / 2);
  const cy = Math.round((el.a.y + el.b.y) / 2);
  const turn = (p: Point): Point => ({ x: cx - (p.y - cy), y: cy + (p.x - cx) });
  return { ...el, a: turn(el.a), b: turn(el.b) };
}
```

`turn` 是以 (cx, cy) 為中心的旋轉：先平移到原點，套用旋轉矩陣，再平移回去。90° 的旋轉矩陣是 `[[0, −1], [1, 0]]`，所以 (dx, dy) 會變成 (−dy, dx)。螢幕座標的 y 軸朝下，因此這在畫面上看起來是**順時針**旋轉。

泛型 `<T extends CircuitElement>` 讓回傳型別和輸入相同：傳入 `Battery`，回傳的也是 `Battery`，不會退化成一般的 `CircuitElement`。

對導線來說，中點可能落在半格上，所以用 `Math.round` 取最近的格點當旋轉中心。一般元件長度固定為 2，中點本來就在格點上，`Math.round` 不會改變它（第 2.2 節決策 2）。

## 5.3 求解器的整體結構（`solver/solve.ts`）

`solve()` 是整個求解器唯一的對外入口，簽名非常簡單：

```ts
export function solve(circuit: Circuit): SolveResult;
```

輸入一個電路，輸出每個元件的結果和錯誤清單。沒有副作用、沒有全域狀態、不會拋出例外（正常情況下）。它的內部是一條管線：

```ts
export function solve(circuit: Circuit): SolveResult {
  const net = buildNetlist(elements); // 格點 → 超節點
  const { componentOf, components } = findComponents(net); // 連通分量
  const sources = analyzeSources(elements, net); // 電池接法檢查
  // ① 每個連通分量各自做 MNA
  // 懸空元件電流設為 0
  // ② 超節點內部分配 0 Ω 元件的電流
  // ③ 組合每個元件的結果；非有限值讓該分量改判為錯誤
  // ④ 收集錯誤訊息（拓樸、奇異、懸空、電壓計）
}
```

（以上為節錄，完整程式碼見原始檔。）

閱讀這種長函式時，可以把每個區段當成一個「階段」：每個階段只讀取前面階段的產出，並寫入自己的產出。例如階段 ① 寫入 `voltage[]` 和 `current[]`，階段 ② 讀取 `current[]` 來計算注入電流。這種「單向的資料流」讓長函式仍然好懂。

### 為什麼用 `Float64Array` 和 `Int32Array`？

```ts
const voltage = new Float64Array(net.supernodeCount);
const current = new Float64Array(elements.length);
```

具型陣列（typed array）有兩個好處：

1. **初始值保證為 0**，不會出現 `undefined`。
2. 記憶體連續、元素型別固定，JavaScript 引擎可以最佳化。

對超節點編號、格點編號這類「索引對索引」的對照表，用 `Int32Array` 也是同樣的道理。

## 5.4 Reducer 與不可變更新（`editor/reducer.ts`）

所有編輯動作都集中在一個 reducer：

```ts
export type EditorAction =
  | { type: 'add'; element: CircuitElement }
  | { type: 'move'; id: string; dx: number; dy: number }
  | { type: 'rotate'; id: string }
  | { type: 'setValue'; id: string; field: ValueField; value: number }
  | { type: 'toggleSwitch'; id: string }
  | { type: 'undo' };
// ……
```

`EditorAction` 也是判別聯合型別，所以 reducer 中的 `switch (action.type)` 有窮舉檢查。

### 兩個小工具函式撐起整個 reducer

```ts
/** 寫入新的電路並記入歷史；電路沒有變化時回傳原狀態。 */
function commit(state: EditorState, circuit: Circuit, selectedId = state.selectedId): EditorState {
  if (circuit === state.circuit) return state;
  return {
    circuit,
    past: [...state.past, state.circuit].slice(-HISTORY_LIMIT),
    future: [],
    selectedId,
  };
}

/** 以 update 取代指定元件；update 回傳 null 代表此操作不合法，電路維持不變。 */
function replaceElement(
  circuit: Circuit,
  id: string,
  update: (el: CircuitElement) => CircuitElement | null,
): Circuit {
  const index = circuit.elements.findIndex((el) => el.id === id);
  const current = circuit.elements[index];
  if (!current) return circuit;
  const next = update(current);
  if (!next || next === current) return circuit;
  const elements = circuit.elements.slice();
  elements[index] = next;
  return { ...circuit, elements };
}
```

這兩個函式之間有一個巧妙的約定：**「沒有變化」用「回傳同一個物件」表示。**

- `replaceElement` 遇到不合法的操作（例如移出畫布），回傳**原本的** `circuit` 物件。
- `commit` 用 `circuit === state.circuit` 檢查。如果是同一個物件，就回傳原本的 `state`，不寫入歷史。

於是每個動作的寫法都變得很短：

```ts
case 'rotate':
  return commit(
    state,
    replaceElement(circuit, action.id, (el) => insideGrid(rotate90(el))),
  );
```

「旋轉後若超出畫布就不動作」這條規則，自然而然地被處理了：`insideGrid` 回傳 `null`，`replaceElement` 回傳原物件，`commit` 回傳原 state。

> **為什麼「不合法的操作不寫入歷史」很重要？** 如果不合法的旋轉也寫入歷史，使用者按 Undo 時會發現「好像什麼都沒發生」，因為那一步本來就沒有改變任何東西。第 8 章故事 3 就是一個和這條規則相關的測試 bug。

### 不可變更新與結構共用

`replaceElement` 只複製了元件**陣列**（`slice()`），沒有複製每個元件。未修改的元件物件在新舊兩個 `Circuit` 之間是**共用**的：

```
舊 Circuit.elements: [e1, e2, e3, e4]
新 Circuit.elements: [e1, e2', e3, e4]   ← 只有 e2 是新物件
```

這就是快照式歷史（ADR-4）不會佔用大量記憶體的原因。它還有另一個好處：`ElementView` 用 `prev.element === next.element` 判斷要不要重繪，只有 `e2` 會重繪。

## 5.5 SVG 互動與效能（`ui/`）

### 從滑鼠座標到格點座標

```ts
const toGrid = (e: PointerEvent): Point => {
  const svg = svgRef.current;
  const ctm = svg?.getScreenCTM();
  if (!svg || !ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return {
    x: clamp(Math.round(p.x / CELL), 0, GRID_WIDTH),
    y: clamp(Math.round(p.y / CELL), 0, GRID_HEIGHT),
  };
};
```

SVG 用 `viewBox` 等比縮放以填滿視窗，所以螢幕上的像素和 SVG 內部座標之間有一個縮放加平移的轉換。`getScreenCTM()` 回傳「SVG 座標 → 螢幕座標」的轉換矩陣，取反矩陣就能把滑鼠位置換回 SVG 座標。最後除以每格的大小並四捨五入，就完成了**吸附格點**。

很多初學者會自己用 `getBoundingClientRect()` 計算縮放比例，但很容易忽略 `preserveAspectRatio` 造成的留白。直接使用瀏覽器提供的轉換矩陣，既簡單又正確。

### 「點擊」與「拖曳」共用同一組事件

```ts
const onPointerUp = () => {
  if (!gesture) return;
  if (gesture.kind === 'drag') {
    const { id, delta } = gesture;
    if (delta.x !== 0 || delta.y !== 0) {
      dispatch({ type: 'move', id, dx: delta.x, dy: delta.y });
    } else if (circuit.elements.find((el) => el.id === id)?.kind === 'switch') {
      // 沒有移動視為點擊：切換開關
      dispatch({ type: 'toggleSwitch', id });
    }
  } else if (gesture.kind === 'endpoint') {
    // ……
  }
  setGesture(null);
};
```

這是第 2.4 節「畫布手勢」狀態機的實作。`gesture` 這個 state 就是狀態機的「目前狀態」，用判別聯合型別表示（`drag`、`endpoint`、`wire`）。

另外注意：**拖曳過程中不會 dispatch 任何動作**，只更新本地的 `gesture` state 來顯示預覽。放開滑鼠時才 dispatch 一次 `move`。這樣拖曳一個元件只會產生一筆歷史紀錄，不會讓 Undo 需要按幾十次。

### 讓 200 個元件只重繪真正改變的那幾個

```ts
function sameResult(p: ElementResult | null | undefined, q: ElementResult | null | undefined) {
  if (p === q) return true;
  if (!p || !q) return false;
  return p.current === q.current && p.voltage === q.voltage && p.power === q.power;
}

export const ElementView = memo(
  ElementViewImpl,
  (prev, next) =>
    prev.element === next.element &&
    prev.selected === next.selected &&
    prev.highlight === next.highlight &&
    prev.showLabels === next.showLabels &&
    sameResult(prev.result, next.result),
);
```

`React.memo` 預設會**淺層比較** props。但 `solve()` 每次都會產生新的結果物件，即使數值完全相同，`prev.result !== next.result` 也成立，所以預設的 memo 等於沒有作用。

解法是自訂比較函式：`element` 用參考比較（因為不可變更新保證了「沒改就是同一個物件」），`result` 用**數值**比較。這樣改一個電阻值時，只有電流真正改變的元件會重繪。

> **思考**：如果是串聯電路，改一個電阻值會讓**所有**元件的電流都改變，memo 就幫不上忙了。為什麼效能仍然達標？（答案：求解只要 0.2 ms，200 個 SVG 元件全部更新也只需要幾毫秒。memo 是錦上添花，不是效能的唯一來源。）

### 不需要 JavaScript 的動畫

```tsx
<line
  className="flow"
  strokeWidth={4}
  strokeLinecap="round"
  strokeDasharray="0.1 11.9"
  style={{
    animationDuration: `${duration}s`,
    animationDirection: current >= 0 ? 'normal' : 'reverse',
  }}
/>
```

```css
@keyframes flow {
  from {
    stroke-dashoffset: 12;
  }
  to {
    stroke-dashoffset: 0;
  }
}
```

這個小技巧值得拆解：

1. `strokeDasharray="0.1 11.9"`：每 12 px 畫一段 0.1 px 長的線，其餘留空。
2. `strokeLinecap="round"`：線段的兩端加上半圓。0.1 px 的線段加上兩個半圓，看起來就是一個**圓點**，直徑等於線寬（4 px）。
3. 動畫讓 `stroke-dashoffset` 從 12 變到 0：虛線的圖樣往前移動一個週期，圓點看起來就在流動。
4. 電流方向相反時，用 `animationDirection: reverse` 讓圓點倒著走。
5. 電流越大，`animationDuration` 越短，圓點流得越快。

整個動畫由瀏覽器的 CSS 引擎執行，**每一幀都不需要執行任何 JavaScript**。如果改用 `requestAnimationFrame` 在 JavaScript 中逐幀更新 200 條導線，就會和求解、React 渲染搶主執行緒的時間。

### 攔截器：讓預測模式不污染畫布元件

預測模式中，「點燈泡」代表「選擇要觀察的燈泡」，「點開關」代表「揭曉結果」。但畫布元件只會 dispatch 一般的編輯動作。要怎麼改變它們的意義？

```ts
/** 預測模式中，畫布上的點擊代表「選擇燈泡／開關」或「揭曉結果」 */
const handleAction = (action: EditorAction) => {
  if (prediction.step === 'pickBulb' && action.type === 'select' && action.id) {
    if (kindOf(action.id) === 'bulb') predict({ type: 'pickBulb', id: action.id });
  } else if (prediction.step === 'pickSwitch' && action.type === 'toggleSwitch') {
    predict({ type: 'pickSwitch', id: action.id });
    return; // 攔截：不真的切換開關
  } else if (/* guess 或 result 狀態 */ action.type === 'toggleSwitch' /* 且是選定的開關 */) {
    revealPrediction();
    return;
  }
  dispatch(action); // 其他動作照常處理
};
```

`App` 把 `handleAction` 而不是原本的 `dispatch` 傳給畫布。畫布完全不知道預測模式的存在，它還是照常 dispatch `select` 和 `toggleSwitch`。這是**攔截器**（interceptor）模式：在不修改元件的情況下改變它的行為。如果把預測模式的判斷寫進 `CircuitCanvas`，畫布就會依賴教學功能，違反依賴方向。

## 5.6 輸入驗證：解析，而非單純檢查（`io/serialize.ts`）

```ts
export function parseCircuit(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: '檔案內容不是有效的 JSON。' };
  }
  try {
    return { ok: true, circuit: toCircuit(data) };
  } catch (error) {
    if (error instanceof InvalidCircuit) return { ok: false, error: error.message };
    throw error;
  }
}
```

幾個設計重點：

1. **`JSON.parse` 的結果型別是 `unknown`**，不是 `any`。`unknown` 會強迫你在使用前先檢查型別。
2. **重新組裝，而不是轉型**。`toElement()` 逐欄讀取、檢查，再組成一個全新的物件。錯誤的寫法是 `return data as Circuit`，它在編譯時看起來沒問題，執行時卻會讓任何垃圾資料通過。這個原則常被稱為 **"Parse, don't validate"**：驗證完之後，得到的是一個型別保證正確的新值，而不是一個「檢查過但型別仍不確定」的舊值。
3. **多餘的欄位自動被丟掉**，因為重新組裝時只讀取已知的欄位。測試 `丟棄多餘的欄位` 驗證了這點。
4. **用 Result 型別回傳錯誤**（`{ ok: true, circuit } | { ok: false, error }`），而不是拋出例外。呼叫端被 TypeScript 強迫處理兩種情況。
5. **只攔截自己的錯誤**：`catch` 中只處理 `InvalidCircuit`，其他例外重新拋出。這樣真正的程式 bug 不會被誤當成「檔案格式錯誤」而被吞掉。

錯誤訊息會指出「第幾個元件、哪一欄、合法範圍是多少」，例如：

```text
第 3 個元件的電阻值必須介於 0.01 到 1000000 Ω 之間。
```

## 5.7 程式風格的幾個約定

| 約定                             | 例子                                              | 理由                                      |
| -------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| 註解寫「為什麼」，不寫「做什麼」 | `// 讓編號較小的當根，結果與合併順序無關`         | 程式碼本身已經說明了做什麼                |
| 魔術數字要命名並註明單位         | `const NO_CURRENT = 1e-9; // A`                   | 數值門檻是重要的設計決定                  |
| 錯誤訊息用使用者的語言           | `'電池的兩端被導線直接接在一起……'`                | 需求 N5                                   |
| 測試名稱寫成一句完整的規格       | `'60 步全部復原後，電路與求解結果和原本完全相同'` | 測試清單本身就是規格文件                  |
| 給測試用的 `data-*` 屬性         | `data-reading`、`data-brightness`                 | E2E 測試不依賴 CSS class 或畫面文字的排版 |

## 本章重點

1. 由內而外閱讀：資料結構 → 資料怎麼改變 → 資料怎麼計算 → 資料怎麼呈現。
2. 判別聯合型別讓不合理的資料無法被表示，並提供窮舉檢查。
3. 「沒有變化就回傳同一個物件」這個約定，讓 reducer 自然地處理不合法操作與歷史紀錄。
4. 不可變更新 + 結構共用 = 便宜的快照 + 精準的重繪。
5. 自訂 memo 比較函式、CSS 動畫，是讓大量元件保持流暢的兩個關鍵。
6. 處理外部輸入時要「解析」，不要只「檢查」。

## 練習

1. **（閱讀）** 在 `reducer.ts` 中，`setValue` 遇到「新值和舊值相同」時會怎麼處理？為什麼要特別處理這個情況？
2. **（型別）** 在 `model/types.ts` 新增一種元件 `'diode'`，執行 `npm run typecheck`，記錄 TypeScript 列出了哪些需要修改的地方。（做完記得還原。）
3. **（效能）** 把 `ElementView` 的自訂比較函式拿掉（改成預設的 `memo`），用 React DevTools 的 Profiler 觀察改一個電阻值時有多少元件重繪。
4. **（動畫）** 把 `strokeDasharray` 改成 `"6 6"`，觀察流動效果有什麼不同。為什麼原作法要用 `0.1` 而不是 `0`？
5. **（驗證）** 寫一個 JSON 檔，故意把某個電池的 `emf` 設成 `-5`，用「開啟」功能讀入，看看錯誤訊息是什麼。再試試把 `kind` 改成 `"capacitor"`。
