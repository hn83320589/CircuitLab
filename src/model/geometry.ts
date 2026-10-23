import type { Point } from './types';

export function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}

export function samePoint(p: Point, q: Point): boolean {
  return p.x === q.x && p.y === q.y;
}
