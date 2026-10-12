import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const HEX_PACK = "kaykit-medieval-hexagon";
const CHAR_PACK = "kaykit-adventurers/characters";

/** Every model we use, so they can all be loaded up front. */
export const MODELS = {
  hex: "tiles/base/hex_grass",
  treesA: "decoration/nature/trees_A_large",
  treesAMed: "decoration/nature/trees_A_medium",
  treesB: "decoration/nature/trees_B_large",
  treesBMed: "decoration/nature/trees_B_medium",
  treeSingle: "decoration/nature/tree_single_B",
  mountainA: "decoration/nature/mountain_A_grass_trees",
  mountainB: "decoration/nature/mountain_B_grass_trees",
  mountainC: "decoration/nature/mountain_C_grass",
  rockA: "decoration/nature/rock_single_A",
  rockB: "decoration/nature/rock_single_C",
  rockC: "decoration/nature/rock_single_E",
  tent: "decoration/props/tent",
  lumber: "decoration/props/resource_lumber",
  crate: "decoration/props/crate_A_small",
  barrel: "decoration/props/barrel",
  sack: "decoration/props/sack",
} as const;

export type ModelName = keyof typeof MODELS;

export const CHARACTERS = ["Rogue_Hooded", "Barbarian", "Mage", "Knight"] as const;
export type CharacterName = (typeof CHARACTERS)[number];

const loader = new GLTFLoader();
const models = new Map<ModelName, THREE.Object3D>();
const characters = new Map<CharacterName, GLTF>();

/**
 * One material shared by every KayKit hex-pack model. They all sample the same
 * 1024x1024 gradient atlas, so regrading that one texture restyles the whole pack.
 */
let atlasMaterial: THREE.MeshStandardMaterial;

export async function loadAssets(onProgress?: (done: number, total: number) => void) {
  const names = Object.keys(MODELS) as ModelName[];
  const total = names.length + CHARACTERS.length + 1;
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  const atlas = await new THREE.TextureLoader().loadAsync(`${HEX_PACK}/tiles/base/hexagons_medieval.png`);
  atlasMaterial = new THREE.MeshStandardMaterial({
    map: regradeAtlas(atlas.image as HTMLImageElement),
    roughness: 0.85,
    metalness: 0,
  });
  tick();

  await Promise.all([
    ...names.map(async (name) => {
      const gltf = await loader.loadAsync(`${HEX_PACK}/${MODELS[name]}.gltf`);
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.material = atlasMaterial;
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      models.set(name, gltf.scene);
      tick();
    }),
    ...CHARACTERS.map(async (name) => {
      characters.set(name, await loader.loadAsync(`${CHAR_PACK}/${name}.glb`));
      tick();
    }),
  ]);
}

export function model(name: ModelName): THREE.Object3D {
  return models.get(name)!.clone();
}

export interface CharacterInstance {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  play(clip: string, fade?: number): void;
}

export function character(name: CharacterName): CharacterInstance {
  const gltf = characters.get(name)!;
  const root = SkeletonUtils.clone(gltf.scene);
  const prefix = name.split("_")[0];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      // The adventurers carry weapons; castaways don't.
      o.visible = o.name.startsWith(prefix);
      o.castShadow = true;
    }
  });
  const mixer = new THREE.AnimationMixer(root);
  let current: THREE.AnimationAction | undefined;
  return {
    root,
    mixer,
    play(clip, fade = 0.3) {
      const anim = gltf.animations.find((a) => a.name === clip);
      if (!anim) return;
      const next = mixer.clipAction(anim);
      if (next === current) return;
      next.reset().fadeIn(fade).play();
      current?.fadeOut(fade);
      current = next;
    },
  };
}

/**
 * KayKit's palette is bright and toy-like. Shift it toward the warmer, deeper
 * look of a cozy painterly game: richer greens, earthier yellows, softer highlights.
 */
function regradeAtlas(img: HTMLImageElement): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const c = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  for (let i = 0; i < px.length; i += 4) {
    c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace);
    c.getHSL(hsl, THREE.SRGBColorSpace);
    const deg = hsl.h * 360;
    if (deg > 45 && deg < 100) {
      // Yellow-green grass toward a lusher green.
      hsl.h = (deg + (112 - deg) * 0.6) / 360;
      hsl.s = Math.min(1, hsl.s * 1.05);
      hsl.l *= 0.78;
    } else if (deg >= 100 && deg < 170) {
      // Pine greens: deeper and slightly cooler.
      hsl.s *= 0.8;
      hsl.l *= 0.82;
    } else if (deg <= 45) {
      // Browns, oranges and reds: earthier.
      hsl.s *= 0.85;
      hsl.l *= 0.92;
    }
    c.setHSL(hsl.h, hsl.s, hsl.l, THREE.SRGBColorSpace);
    c.getRGB(c, THREE.SRGBColorSpace);
    px[i] = c.r * 255;
    px[i + 1] = c.g * 255;
    px[i + 2] = c.b * 255;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 4;
  return tex;
}
