export class UnionFind {
  private readonly parent: Int32Array;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
  }

  find(i: number): number {
    let root = i;
    while (this.parent[root] !== root) root = this.parent[root] as number;
    // 路徑壓縮
    let node = i;
    while (node !== root) {
      const next = this.parent[node] as number;
      this.parent[node] = root;
      node = next;
    }
    return root;
  }

  /** 合併兩個集合；原本就在同一集合時回傳 false。 */
  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    // 讓編號較小的當根，結果與合併順序無關
    if (ra < rb) this.parent[rb] = ra;
    else this.parent[ra] = rb;
    return true;
  }
}
