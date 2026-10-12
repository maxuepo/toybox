// All tunable numbers live here so balancing doesn't mean touching game code.

export type Resource = "wood" | "stone" | "berries";
export type Resources = Record<Resource, number>;

export const RESOURCES: readonly Resource[] = ["wood", "stone", "berries"];

export const RESOURCE_ICON: Record<Resource, string> = {
  wood: "🪵",
  stone: "🪨",
  berries: "🍒",
};

export const STORAGE_CAP: Resources = { wood: 20, stone: 30, berries: 30 };
export const START_RESOURCES: Resources = { wood: 4, stone: 0, berries: 6 };

export const HAND_SIZE = 2;
/** Furthest a tile may be placed from the camp. */
export const MAX_RADIUS = 7;
/** The lighthouse islet; connect land to it to finish the first goal. */
export const LIGHTHOUSE = { q: 5, r: -4 };
