import * as THREE from "three";
import type { CardKind } from "../game/cards";
import { buildTile } from "./tiles";
import { seededRng } from "./tween";

/**
 * Card illustrations rendered from the real tile models, so the art always
 * matches what lands on the island. Rendered once at startup.
 */
export function renderCardArt(kinds: CardKind[]): Record<CardKind, string> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(320, 280);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.shadowMap.enabled = true;
  const camera = new THREE.PerspectiveCamera(28, 320 / 280, 0.1, 50);
  camera.position.set(3.4, 3.6, 4.6);
  camera.lookAt(0, 0.1, 0);

  const art = {} as Record<CardKind, string>;
  for (const kind of kinds) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#e8f2ff", "#806848", 1.6));
    const sun = new THREE.DirectionalLight("#ffe6c4", 3);
    sun.position.set(-3, 6, 4);
    sun.castShadow = true;
    scene.add(sun);
    const tile = buildTile(kind, seededRng(kind.length * 977));
    tile.group.position.y = 0.25;
    scene.add(tile.group);
    renderer.render(scene, camera);
    art[kind] = renderer.domElement.toDataURL("image/png");
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return art;
}
