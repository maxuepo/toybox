import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import type { TileKind } from "../game/cards";
import { HEX_SIZE, fromWorld, key, toWorld, type Hex } from "../game/hex";
import { character, model, type CharacterInstance, type CharacterName } from "./assets";
import { lighthouse, type Campfire, type Lighthouse } from "./props";
import { buildTile, setWoodpile, type TileVisual } from "./tiles";
import { Tweens, easeOutBack, easeOutCubic, hexSeed, seededRng } from "./tween";
import { WATER_LEVEL, Water } from "./water";

const SKY = new THREE.Color("#a8d3e3");
const SUN_DIR = new THREE.Vector3(-0.55, 0.75, 0.45).normalize();

/** Owns the Three.js scene: island tiles, water, lighting, camera and effects. */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  private scene = new THREE.Scene();
  private controls: OrbitControls;
  private composer: EffectComposer;
  private water: Water;
  private tweens = new Tweens();
  private timer = new THREE.Timer();
  private tiles = new Map<string, TileVisual>();
  private campfires: Campfire[] = [];
  private lighthouse?: Lighthouse;
  private lighthouseHex?: Hex;
  private castaways: CharacterInstance[] = [];
  private rings = new THREE.Group();
  private ghost = new THREE.Group();
  private ghostHex?: string;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  /** Called every frame after the scene renders, e.g. to move DOM labels. */
  onFrame?: () => void;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = SKY;
    this.scene.fog = new THREE.Fog(SKY, 32, 75);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);
    this.camera.position.set(2, 15.5, 15);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(2, 0, -1.8);
    this.controls.enableDamping = true;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 32;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.05;
    this.controls.screenSpacePanning = false;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.addEventListener("change", () => {
      // Keep the island in view.
      this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x, -10, 10);
      this.controls.target.z = THREE.MathUtils.clamp(this.controls.target.z, -10, 10);
      this.controls.target.y = 0;
    });

    this.addLights();

    this.water = new Water(SUN_DIR);
    this.water.setFog(this.scene.fog);
    this.scene.add(this.water.mesh, this.rings, this.ghost);

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new EffectPass(
        this.camera,
        new BloomEffect({ luminanceThreshold: 0.9, intensity: 0.7, mipmapBlur: true, radius: 0.7 }),
        new VignetteEffect({ darkness: 0.42, offset: 0.32 }),
        new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      ),
    );
    this.composer.addPass(new EffectPass(this.camera, new SMAAEffect()));

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private addLights() {
    this.scene.add(new THREE.HemisphereLight("#d6ecff", "#7a6542", 1.25));
    const sun = new THREE.DirectionalLight("#ffe2b8", 3.1);
    sun.position.copy(SUN_DIR).multiplyScalar(30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = s.bottom = -16;
    s.right = s.top = 16;
    s.near = 5;
    s.far = 70;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.renderer.domElement.parentElement!;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  private frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const t = this.timer.getElapsed();
    this.tweens.update(t);
    this.controls.update();
    this.water.update(t);
    for (const f of this.campfires) f.update(t);
    this.lighthouse?.update(t);
    for (const c of this.castaways) c.mixer.update(dt);
    for (const ring of this.rings.children) {
      ((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.15 * Math.sin(t * 3);
    }
    this.ghost.position.y = 0.12 + 0.05 * Math.sin(t * 4);
    this.composer.render(dt);
    this.onFrame?.();
  }

  // --- Island -----------------------------------------------------------------

  addTile(hex: Hex, kind: TileKind, animate: boolean): Promise<void> {
    const visual = buildTile(kind, seededRng(hexSeed(hex.q, hex.r)));
    const { x, z } = toWorld(hex);
    visual.group.position.set(x, 0, z);
    this.scene.add(visual.group);
    this.tiles.set(key(hex), visual);
    if (visual.campfire) this.campfires.push(visual.campfire);
    this.refreshWater();
    if (!animate) return Promise.resolve();

    const g = visual.group;
    const landed = this.tweens.add(0.55, (k) => {
      const e = easeOutBack(k);
      g.position.y = (1 - easeOutCubic(k)) * 1.6;
      g.scale.setScalar(0.6 + 0.4 * e);
    });
    visual.decorations.forEach((d, i) => {
      const target = d.scale.clone();
      this.tweens.add(0.4, (k) => d.scale.copy(target).multiplyScalar(Math.max(0.001, easeOutBack(k))), 0.3 + i * 0.06);
    });
    return landed;
  }

  setWood(wood: number) {
    for (const t of this.tiles.values()) if (t.woodpile) setWoodpile(t.woodpile, wood);
  }

  addLighthouse(hex: Hex) {
    const { x, z } = toWorld(hex);
    const islet = new THREE.Group();
    islet.position.set(x, WATER_LEVEL, z);
    const base = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.62, 1),
      new THREE.MeshStandardMaterial({ color: "#7d7064", flatShading: true, roughness: 1 }),
    );
    base.scale.set(1, 0.42, 1);
    base.castShadow = base.receiveShadow = true;
    islet.add(base);
    for (const [name, a, r, s] of [
      ["rockA", 0.3, 0.55, 1.6],
      ["rockB", 2.4, 0.6, 1.4],
      ["rockC", 4.2, 0.5, 1.8],
    ] as const) {
      const rock = model(name);
      rock.position.set(Math.cos(a) * r, -0.05, Math.sin(a) * r);
      rock.scale.setScalar(s);
      islet.add(rock);
    }
    this.lighthouse = lighthouse();
    this.lighthouse.group.position.y = 0.2;
    islet.add(this.lighthouse.group);
    this.scene.add(islet);
    this.lighthouseHex = hex;
    this.refreshWater();
  }

  private refreshWater() {
    const land = [...this.tiles.keys()].map((k) => {
      const [q, r] = k.split(",").map(Number);
      return { q, r };
    });
    const circles = this.lighthouseHex ? [{ ...toWorld(this.lighthouseHex), r: 0.62 }] : [];
    this.water.setLand(land, circles);
  }

  // --- Castaways --------------------------------------------------------------

  addCastaway(name: CharacterName, hex: Hex, offset: { x: number; z: number; face: number }, clip: string) {
    const c = character(name);
    const { x, z } = toWorld(hex);
    c.root.position.set(x + offset.x, 0, z + offset.z);
    c.root.rotation.y = offset.face;
    c.root.scale.setScalar(0.24);
    c.play(clip, 0);
    this.scene.add(c.root);
    this.castaways.push(c);
    return c;
  }

  // --- Placement feedback -----------------------------------------------------

  /** Show pulsing outlines where a tile can go, or hide them with `null`. */
  showPlaceable(hexes: Hex[] | null) {
    this.rings.clear();
    if (!hexes) return;
    const geo = new THREE.RingGeometry(HEX_SIZE * 0.8, HEX_SIZE * 0.9, 6, 1, Math.PI / 6);
    geo.rotateX(-Math.PI / 2);
    for (const h of hexes) {
      const ring = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: "#fffaf0", transparent: true, opacity: 0.45, depthWrite: false }),
      );
      const { x, z } = toWorld(h);
      ring.position.set(x, WATER_LEVEL + 0.06, z);
      this.rings.add(ring);
    }
  }

  /** A translucent preview of the tile that would be placed at `hex`. */
  showGhost(hex: Hex | null, kind?: TileKind) {
    const k = hex && kind ? `${key(hex)}:${kind}` : undefined;
    if (k === this.ghostHex) return;
    this.ghostHex = k;
    this.ghost.clear();
    if (!hex || !kind) return;
    const visual = buildTile(kind, seededRng(hexSeed(hex.q, hex.r)));
    visual.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = GHOST_MATERIAL;
        o.castShadow = false;
      }
      if (o instanceof THREE.Light) o.visible = false;
    });
    const { x, z } = toWorld(hex);
    visual.group.position.set(x, 0, z);
    this.ghost.add(visual.group);
  }

  /** The hex under a screen point, measured on the tile-top plane. */
  pickHex(clientX: number, clientY: number): Hex | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    return fromWorld(hit.x, hit.z);
  }

  /** Screen position of a point above a hex, for DOM labels. */
  toScreen(hex: Hex, height = 0.6): { x: number; y: number } {
    const { x, z } = toWorld(hex);
    const v = new THREE.Vector3(x, height, z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }
}

const GHOST_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#f4ffe6",
  emissive: "#9fd88a",
  emissiveIntensity: 0.35,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});
