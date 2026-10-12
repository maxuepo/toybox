// Axial hex coordinates for pointy-top hexes (https://www.redblobgames.com/grids/hexagons/).
// KayKit tiles are 2 units flat-to-flat, so the circumradius is 2/sqrt(3).

export interface Hex {
  q: number;
  r: number;
}

export const HEX_SIZE = 2 / Math.sqrt(3);
const SQRT3 = Math.sqrt(3);

export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const key = (h: Hex) => `${h.q},${h.r}`;

export function fromKey(k: string): Hex {
  const [q, r] = k.split(",").map(Number);
  return { q, r };
}

export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

export const neighbors = (h: Hex): Hex[] => DIRECTIONS.map((d) => add(h, d));

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function toWorld(h: Hex): { x: number; z: number } {
  return {
    x: HEX_SIZE * SQRT3 * (h.q + h.r / 2),
    z: HEX_SIZE * 1.5 * h.r,
  };
}

export function fromWorld(x: number, z: number): Hex {
  const q = ((SQRT3 / 3) * x - z / 3) / HEX_SIZE;
  const r = ((2 / 3) * z) / HEX_SIZE;
  return round(q, r);
}

function round(fq: number, fr: number): Hex {
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q + 0, r: r + 0 };
}
