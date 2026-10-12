import { CARDS, tileYield, type CardKind, type IslandView, type TileKind } from "./cards";
import {
  HAND_SIZE,
  LIGHTHOUSE,
  MAX_RADIUS,
  RESOURCES,
  START_RESOURCES,
  STORAGE_CAP,
  type Resources,
} from "./config";
import { distance, fromKey, key, neighbors, type Hex } from "./hex";

export interface Objective {
  id: string;
  title: string;
  hint: string;
  progress: (s: GameState) => [number, number];
}

export const OBJECTIVES: Objective[] = [
  {
    id: "forest",
    title: "Grow the woods",
    hint: "Place a Forest card next to another forest",
    progress: (s) => [Math.min(s.count("forest"), 3), 3],
  },
  {
    id: "woodpile",
    title: "Stock the woodpile",
    hint: "Have 10 wood stacked by the camp",
    progress: (s) => [Math.min(s.resources.wood, 10), 10],
  },
  {
    id: "range",
    title: "Raise a range",
    hint: "Line up 3 mountains in a row",
    progress: (s) => [Math.min(s.longestRange(), 3), 3],
  },
  {
    id: "lighthouse",
    title: "Reach the lighthouse",
    hint: "Grow the island until it touches the lighthouse rock",
    progress: (s) => [s.reachedLighthouse() ? 1 : 0, 1],
  },
];

export interface DayReport {
  /** Per-tile production, for floating "+N" labels. */
  perTile: { hex: Hex; gained: Partial<Resources> }[];
  completed: Objective[];
}

export class GameState implements IslandView {
  readonly tiles = new Map<string, TileKind>();
  resources: Resources = { ...START_RESOURCES };
  day = 1;
  hand: CardKind[] = [];
  readonly done = new Set<string>();

  constructor(private rng: () => number = Math.random) {
    this.tiles.set(key({ q: 0, r: 0 }), "camp");
    this.tiles.set(key({ q: 1, r: 0 }), "forest");
    this.tiles.set(key({ q: 1, r: -1 }), "forest");
    this.tiles.set(key({ q: -1, r: 1 }), "meadow");
    this.drawHand();
  }

  kindAt(h: Hex): TileKind | undefined {
    return this.tiles.get(key(h));
  }

  count(kind: TileKind): number {
    return [...this.tiles.values()].filter((k) => k === kind).length;
  }

  canAfford(card: CardKind): boolean {
    const cost = CARDS[card].cost;
    return RESOURCES.every((r) => this.resources[r] >= (cost[r] ?? 0));
  }

  canPlaceAt(h: Hex): boolean {
    if (this.tiles.has(key(h))) return false;
    if (key(h) === key(LIGHTHOUSE)) return false;
    if (distance(h, { q: 0, r: 0 }) > MAX_RADIUS) return false;
    return neighbors(h).some((n) => this.tiles.has(key(n)));
  }

  /** Every empty hex where a tile could go right now. */
  placeableHexes(): Hex[] {
    const out = new Map<string, Hex>();
    for (const k of this.tiles.keys()) {
      for (const n of neighbors(fromKey(k))) {
        if (this.canPlaceAt(n)) out.set(key(n), n);
      }
    }
    return [...out.values()];
  }

  place(handIndex: number, at: Hex): DayReport | null {
    const card = this.hand[handIndex];
    if (card === undefined || !this.canAfford(card) || !this.canPlaceAt(at)) return null;
    const cost = CARDS[card].cost;
    for (const r of RESOURCES) this.resources[r] -= cost[r] ?? 0;
    this.tiles.set(key(at), card);
    return this.endDay();
  }

  /** Skip placing a tile: the island still produces, and a fresh hand is drawn. */
  rest(): DayReport {
    return this.endDay();
  }

  longestRange(): number {
    let best = 0;
    for (const [k, kind] of this.tiles) {
      if (kind !== "mountain") continue;
      const y = tileYield(this, fromKey(k), "mountain").stone ?? 0;
      best = Math.max(best, y);
    }
    return best;
  }

  reachedLighthouse(): boolean {
    return neighbors(LIGHTHOUSE).some((n) => this.tiles.has(key(n)));
  }

  private endDay(): DayReport {
    const perTile: DayReport["perTile"] = [];
    for (const [k, kind] of this.tiles) {
      const hex = fromKey(k);
      const gained = tileYield(this, hex, kind);
      perTile.push({ hex, gained });
      for (const r of RESOURCES) {
        this.resources[r] = Math.min(STORAGE_CAP[r], this.resources[r] + (gained[r] ?? 0));
      }
    }
    this.day++;
    this.drawHand();
    const completed = OBJECTIVES.filter((o) => {
      if (this.done.has(o.id)) return false;
      const [have, need] = o.progress(this);
      return have >= need;
    });
    for (const o of completed) this.done.add(o.id);
    return { perTile, completed };
  }

  private drawHand() {
    const kinds = Object.keys(CARDS) as CardKind[];
    const total = kinds.reduce((sum, k) => sum + CARDS[k].weight, 0);
    this.hand = [];
    while (this.hand.length < HAND_SIZE) {
      let roll = this.rng() * total;
      const pick = kinds.find((k) => (roll -= CARDS[k].weight) < 0) ?? kinds[0];
      // Two different cards make the choice interesting.
      if (!this.hand.includes(pick)) this.hand.push(pick);
    }
  }
}
