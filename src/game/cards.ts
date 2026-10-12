import type { Resources } from "./config";
import { DIRECTIONS, add, key, neighbors, type Hex } from "./hex";

export type TileKind = "camp" | "meadow" | "forest" | "mountain";
export type CardKind = Exclude<TileKind, "camp">;

/** Read-only view of the island that yield rules can query. */
export interface IslandView {
  kindAt(h: Hex): TileKind | undefined;
}

export interface CardDef {
  name: string;
  cost: Partial<Resources>;
  text: string;
  /** Relative chance of being drawn. */
  weight: number;
}

export const CARDS: Record<CardKind, CardDef> = {
  meadow: {
    name: "Meadow",
    cost: { wood: 1 },
    text: "Gives berries, more beside a forest.",
    weight: 3,
  },
  forest: {
    name: "Forest",
    cost: { berries: 3 },
    text: "Gives wood, more in a bigger forest.",
    weight: 3,
  },
  mountain: {
    name: "Mountain",
    cost: { wood: 2, berries: 3 },
    text: "Gives stone, more along a range.",
    weight: 2,
  },
};

/** Size of the connected group of `kind` tiles containing `start`. */
export function clusterSize(island: IslandView, start: Hex, kind: TileKind): number {
  const seen = new Set([key(start)]);
  const stack = [start];
  while (stack.length) {
    const h = stack.pop()!;
    for (const n of neighbors(h)) {
      if (!seen.has(key(n)) && island.kindAt(n) === kind) {
        seen.add(key(n));
        stack.push(n);
      }
    }
  }
  return seen.size;
}

/** Longest straight line of `kind` tiles passing through `start`, along any of the 3 hex axes. */
export function lineLength(island: IslandView, start: Hex, kind: TileKind): number {
  let best = 1;
  for (let axis = 0; axis < 3; axis++) {
    let len = 1;
    for (const dir of [DIRECTIONS[axis], DIRECTIONS[axis + 3]]) {
      let h = add(start, dir);
      while (island.kindAt(h) === kind) {
        len++;
        h = add(h, dir);
      }
    }
    best = Math.max(best, len);
  }
  return best;
}

/** What a tile of `kind` at `h` produces each day. */
export function tileYield(island: IslandView, h: Hex, kind: TileKind): Partial<Resources> {
  switch (kind) {
    case "camp":
      return { berries: 1 };
    case "meadow": {
      const forests = neighbors(h).filter((n) => island.kindAt(n) === "forest").length;
      return { berries: 1 + Math.min(2, forests) };
    }
    case "forest":
      return { wood: 1 + Math.floor(clusterSize(island, h, "forest") / 3) };
    case "mountain":
      return { stone: Math.min(4, lineLength(island, h, "mountain")) };
  }
}

/** A view of `island` with one extra hypothetical tile, used to preview placements. */
export function withTile(island: IslandView, at: Hex, kind: TileKind): IslandView {
  const k = key(at);
  return { kindAt: (h) => (key(h) === k ? kind : island.kindAt(h)) };
}
