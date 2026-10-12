import * as THREE from "three";

// Small props the KayKit packs don't include, built from primitives in the same low-poly style.

const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

const leaf = flat("#4e8a3a");
const leafDark = flat("#3d7330");
const berry = flat("#c8323c", { roughness: 0.5 });

export function berryBush(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), rng() > 0.5 ? leaf : leafDark);
  body.scale.set(1.15, 0.8, 1.15);
  body.position.y = 0.08;
  g.add(body);
  const berryGeo = new THREE.IcosahedronGeometry(0.028, 0);
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    const b = new THREE.Mesh(berryGeo, berry);
    b.position.set(Math.cos(a) * 0.12, 0.06 + rng() * 0.1, Math.sin(a) * 0.12);
    g.add(b);
  }
  return shadowed(g);
}

export interface Campfire {
  group: THREE.Group;
  update(time: number): void;
}

export function campfire(): Campfire {
  const g = new THREE.Group();
  const stone = flat("#8d8a84");
  const stoneGeo = new THREE.DodecahedronGeometry(0.045, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = new THREE.Mesh(stoneGeo, stone);
    s.position.set(Math.cos(a) * 0.14, 0.02, Math.sin(a) * 0.14);
    s.rotation.set(i, i * 2, 0);
    g.add(s);
  }
  const log = flat("#6b4a2f");
  const logGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.22, 6);
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(logGeo, log);
    l.rotation.set(Math.PI / 2 - 0.5, (i / 3) * Math.PI * 2, 0, "YXZ");
    l.position.y = 0.06;
    g.add(l);
  }
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.2, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff4a12").multiplyScalar(4), toneMapped: false }),
  );
  outer.position.y = 0.13;
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.13, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb630").multiplyScalar(4), toneMapped: false }),
  );
  inner.position.y = 0.1;
  const light = new THREE.PointLight("#ff9a4a", 2.5, 3.5, 1.6);
  light.position.y = 0.35;
  g.add(outer, inner, light);
  shadowed(g);
  outer.castShadow = inner.castShadow = false;

  return {
    group: g,
    update(t) {
      const f = 1 + 0.12 * Math.sin(t * 13) + 0.08 * Math.sin(t * 7.3);
      outer.scale.set(1, f, 1);
      inner.scale.set(1, 2 - f, 1);
      outer.rotation.y = t * 2;
      light.intensity = 2.2 * f;
    },
  };
}

export interface Lighthouse {
  group: THREE.Group;
  update(time: number): void;
}

export function lighthouse(): Lighthouse {
  const g = new THREE.Group();
  const height = 1.5;
  const bands = 5;
  const tower = new THREE.CylinderGeometry(0.2, 0.3, height, 12, bands * 2).toNonIndexed();
  // Paint red and white stripes with vertex colours.
  const pos = tower.attributes.position;
  const colors: number[] = [];
  const red = new THREE.Color("#c63c35");
  const white = new THREE.Color("#f3eee4");
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const band = Math.floor(((y + height / 2) / height) * bands);
    const c = band % 2 === 0 ? white : red;
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  tower.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  tower.computeVertexNormals();
  const body = new THREE.Mesh(tower, flat("#ffffff", { vertexColors: true }));
  body.position.y = height / 2;

  const dark = flat("#3a3632");
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12), dark);
  gallery.position.y = height + 0.02;
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.22, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe9a8").multiplyScalar(2), toneMapped: false }),
  );
  lamp.position.y = height + 0.16;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.25, 12), flat("#b5332d"));
  roof.position.y = height + 0.39;
  const light = new THREE.PointLight("#ffe2a0", 1.5, 4, 1.5);
  light.position.y = height + 0.2;
  g.add(body, gallery, lamp, roof, light);
  shadowed(g);
  lamp.castShadow = false;

  return {
    group: g,
    update(t) {
      light.intensity = 1.2 + 0.5 * Math.sin(t * 2);
    },
  };
}
