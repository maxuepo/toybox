import * as THREE from "three";
import type { TileKind } from "../game/cards";
import { HEX_SIZE } from "../game/hex";
import { model, type ModelName } from "./assets";
import { berryBush, campfire, type Campfire } from "./props";

export interface TileVisual {
  group: THREE.Group;
  /** Children that pop in one after another when the tile lands. */
  decorations: THREE.Object3D[];
  campfire?: Campfire;
  woodpile?: THREE.Group;
}

const pick = <T>(rng: () => number, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const sixth = (rng: () => number) => Math.floor(rng() * 6) * (Math.PI / 3);

function place(name: ModelName, x: number, z: number, rotY = 0, scale = 1): THREE.Object3D {
  const m = model(name);
  m.position.set(x, 0, z);
  m.rotation.y = rotY;
  m.scale.setScalar(scale);
  return m;
}

export function buildTile(kind: TileKind, rng: () => number): TileVisual {
  const group = new THREE.Group();
  group.add(model("hex"), cliffSkirt(rng));
  const decorations: THREE.Object3D[] = [];
  const visual: TileVisual = { group, decorations };

  switch (kind) {
    case "forest":
      decorations.push(place(pick(rng, ["treesA", "treesB"] as const), 0, 0, sixth(rng), 1.05));
      break;
    case "mountain":
      decorations.push(place(pick(rng, ["mountainA", "mountainB", "mountainC"] as const), 0, 0, sixth(rng), 0.95));
      break;
    case "meadow": {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rng() * 0.6;
        const r = 0.35 + rng() * 0.4;
        const bush = berryBush(rng);
        bush.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        bush.scale.setScalar(0.9 + rng() * 0.5);
        decorations.push(bush);
      }
      decorations.push(place("treeSingle", (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4, rng() * 6, 0.8));
      decorations.push(place(pick(rng, ["rockA", "rockB", "rockC"] as const), 0.55, -0.45, rng() * 6, 0.6));
      break;
    }
    case "camp": {
      decorations.push(place("tent", -0.4, -0.35, 0.5, 1.25));
      const fire = campfire();
      fire.group.position.set(0.2, 0, 0.25);
      decorations.push(fire.group);
      visual.campfire = fire;
      decorations.push(place("crate", -0.65, 0.35, 0.3, 0.9));
      decorations.push(place("barrel", -0.5, 0.55, 0, 0.8));
      decorations.push(place("sack", 0.55, -0.45, 1.2, 0.9));
      const pile = new THREE.Group();
      pile.position.set(0.55, 0, 0.55);
      pile.rotation.y = -0.6;
      decorations.push(pile);
      visual.woodpile = pile;
      break;
    }
  }
  group.add(...decorations);
  return visual;
}

/** Stack lumber by the camp so the wood count is visible in the world. */
export function setWoodpile(pile: THREE.Group, wood: number) {
  const stacks = Math.min(6, Math.ceil(wood / 4));
  while (pile.children.length > stacks) pile.remove(pile.children[pile.children.length - 1]);
  while (pile.children.length < stacks) {
    const i = pile.children.length;
    const piece = model("lumber");
    piece.scale.setScalar(0.55);
    piece.position.set((i % 2) * 0.05 - 0.02, Math.floor(i / 2) * 0.1, (i % 3) * 0.04);
    piece.rotation.y = (i % 2) * 0.15;
    pile.add(piece);
  }
}

// --- Cliff skirt ------------------------------------------------------------

const SKIRT_TOP = -0.05;
const SKIRT_BOTTOM = -1.0;
const ROWS = 5;
const COLS = 4;
const soil = new THREE.Color("#5c4330");
const rockA = new THREE.Color("#6d5d4f");
const rockB = new THREE.Color("#4e4239");
const skirtMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 1,
  side: THREE.DoubleSide,
});

/**
 * KayKit tiles have flat, clean sides. Wrap each one in a jagged band of soil and
 * layered rock so the island reads as a chunk of land rising out of the sea.
 */
function cliffSkirt(rng: () => number): THREE.Mesh {
  const corners: THREE.Vector2[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    corners.push(new THREE.Vector2(Math.cos(a) * HEX_SIZE, Math.sin(a) * HEX_SIZE));
  }
  // A grid of points per side; rows run top to bottom.
  const positions: number[] = [];
  const colors: number[] = [];
  const grid: THREE.Vector3[][] = [];
  const totalCols = COLS * 6;
  for (let row = 0; row <= ROWS; row++) {
    const t = row / ROWS;
    const y = SKIRT_TOP + (SKIRT_BOTTOM - SKIRT_TOP) * t;
    const line: THREE.Vector3[] = [];
    for (let col = 0; col < totalCols; col++) {
      const side = Math.floor(col / COLS);
      const f = (col % COLS) / COLS;
      const p = corners[side].clone().lerp(corners[(side + 1) % 6], f);
      // Bulge out a little, more in the middle rows, so the cliff overhangs the water slightly.
      const out = 1.01 + rng() * 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.4));
      const jitter = row > 0 && row < ROWS ? (rng() - 0.5) * 0.14 : 0;
      line.push(new THREE.Vector3(p.x * out, y + jitter, p.y * out));
    }
    grid.push(line);
  }
  // Colour each quad separately so the strata read as rough rock, not neat layers.
  const quadColor = (row: number) => {
    const t = row / (ROWS - 1);
    const base = row === 0 ? soil : rockA.clone().lerp(rockB, Math.min(1, t * 0.8 + rng() * 0.45));
    return base.clone().multiplyScalar(0.84 + rng() * 0.3);
  };
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < totalCols; col++) {
      const c = quadColor(row);
      const a = grid[row][col];
      const b = grid[row][(col + 1) % totalCols];
      const cc = grid[row + 1][col];
      const d = grid[row + 1][(col + 1) % totalCols];
      for (const v of [a, cc, b, b, cc, d]) {
        positions.push(v.x, v.y, v.z);
        colors.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, skirtMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
