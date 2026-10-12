import * as THREE from "three";
import { toWorld, type Hex } from "../game/hex";

export const WATER_LEVEL = -0.32;

/** World-space square covered by the shore distance field. */
const FIELD_EXTENT = 22;
const FIELD_RES = 256;
/** Distances are stored in a byte; this is the farthest one we keep (world units). */
const MAX_DIST = 5;

/**
 * Stylized water: depth tint from a distance-to-shore field, animated
 * normals for sun glints, and foam that laps against the coast.
 */
export class Water {
  readonly mesh: THREE.Mesh;
  private field: THREE.DataTexture;
  private material: THREE.ShaderMaterial;

  constructor(sunDir: THREE.Vector3) {
    this.field = new THREE.DataTexture(
      new Uint8Array(FIELD_RES * FIELD_RES).fill(255),
      FIELD_RES,
      FIELD_RES,
      THREE.RedFormat,
    );
    this.field.magFilter = THREE.LinearFilter;
    this.field.minFilter = THREE.LinearFilter;
    this.field.needsUpdate = true;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uField: { value: this.field },
        uExtent: { value: FIELD_EXTENT },
        uMaxDist: { value: MAX_DIST },
        uSunDir: { value: sunDir.clone().normalize() },
        uShallow: { value: new THREE.Color("#3fb8c4") },
        uMid: { value: new THREE.Color("#1d7fa8") },
        uDeep: { value: new THREE.Color("#0f4d86") },
        uSky: { value: new THREE.Color("#bfe0ef") },
        uFogColor: { value: new THREE.Color() },
        uFogNear: { value: 0 },
        uFogFar: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: false,
    });

    const geo = new THREE.PlaneGeometry(240, 240, 240, 240);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = WATER_LEVEL;
    this.mesh.renderOrder = -1;
  }

  setFog(fog: THREE.Fog) {
    this.material.uniforms.uFogColor.value.copy(fog.color);
    this.material.uniforms.uFogNear.value = fog.near;
    this.material.uniforms.uFogFar.value = fog.far;
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  /** Rebuild the distance-to-shore field from the land hexes. */
  setLand(land: Hex[], extraCircles: { x: number; z: number; r: number }[] = []) {
    const centers = land.map(toWorld);
    const data = this.field.image.data as Uint8Array;
    const cell = (FIELD_EXTENT * 2) / FIELD_RES;
    for (let j = 0; j < FIELD_RES; j++) {
      const z = -FIELD_EXTENT + (j + 0.5) * cell;
      for (let i = 0; i < FIELD_RES; i++) {
        const x = -FIELD_EXTENT + (i + 0.5) * cell;
        let d = MAX_DIST;
        for (const c of centers) {
          const dx = Math.abs(x - c.x);
          const dz = Math.abs(z - c.z);
          if (dx > d + 1.2 || dz > d + 1.2) continue;
          d = Math.min(d, hexSdf(dx, dz));
        }
        for (const c of extraCircles) {
          d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
        }
        data[j * FIELD_RES + i] = Math.round((Math.max(0, d) / MAX_DIST) * 255);
      }
    }
    this.field.needsUpdate = true;
  }
}

/** Signed distance to a pointy-top hexagon with inradius 1 (flats at x = ±1), given |dx|, |dz|. */
function hexSdf(px: number, pz: number): number {
  // iq's hexagon SDF, with the flat axis mapped to x.
  const kx = -0.866025404;
  const ky = 0.5;
  const kz = 0.577350269;
  let x = pz;
  let y = px;
  const dot = Math.min(kx * x + ky * y, 0);
  x -= 2 * dot * kx;
  y -= 2 * dot * ky;
  const cx = Math.min(Math.max(x, -kz), kz);
  x -= cx;
  y -= 1;
  return Math.hypot(x, y) * Math.sign(y);
}

const NOISE = /* glsl */ `
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
               mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
  }
`;

const VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying float vViewDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    world.y += 0.035 * sin(world.x * 0.55 + uTime * 1.1) + 0.03 * sin(world.z * 0.7 - uTime * 0.9);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vViewDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uField;
  uniform float uExtent;
  uniform float uMaxDist;
  uniform vec3 uSunDir;
  uniform vec3 uShallow;
  uniform vec3 uMid;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorld;
  varying float vViewDepth;
  ${NOISE}

  float shoreDist(vec2 p) {
    vec2 uv = (p + uExtent) / (2.0 * uExtent);
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return uMaxDist;
    return texture2D(uField, uv).r * uMaxDist;
  }

  float waves(vec2 p) {
    float t = uTime;
    return noise(p * 1.3 + vec2(t * 0.35, t * 0.2)) * 0.5
         + noise(p * 2.9 - vec2(t * 0.25, -t * 0.4)) * 0.3
         + noise(p * 6.1 + vec2(-t * 0.6, t * 0.5)) * 0.15;
  }

  void main() {
    vec2 p = vWorld.xz;
    // Wobble the field lookup so the coastline isn't a perfect hexagon.
    vec2 wob = vec2(noise(p * 1.7 + uTime * 0.15), noise(p * 1.7 - 9.0 - uTime * 0.15)) * 0.22;
    float d = shoreDist(p + wob);

    // Normal from the wave heightfield.
    float e = 0.04;
    float h = waves(p);
    vec3 n = normalize(vec3(-(waves(p + vec2(e, 0)) - h) / e * 0.18, 1.0, -(waves(p + vec2(0, e)) - h) / e * 0.18));

    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);

    // Depth tint: turquoise shallows fading into deep blue.
    vec3 col = mix(uShallow, uMid, smoothstep(0.2, 2.2, d));
    col = mix(col, uDeep, smoothstep(1.8, 4.8, d));
    col *= 0.9 + 0.2 * h;
    col = mix(col, uSky, fresnel * 0.45);

    // Sun glints.
    vec3 hv = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, hv), 0.0), 260.0);
    col += vec3(1.0, 0.95, 0.85) * spec * 2.2;

    // Foam: a solid lip against the coast plus bands that roll in toward it.
    float n1 = noise(p * 3.0 + uTime * 0.3) * 0.5 + 0.5;
    float lip = 1.0 - smoothstep(0.04, 0.16 + 0.08 * n1, d);
    float band = sin(d * 9.0 + uTime * 2.2) * 0.5 + 0.5;
    band = smoothstep(0.75, 0.95, band) * (1.0 - smoothstep(0.15, 0.85, d));
    band *= smoothstep(0.35, 0.65, noise(p * 2.2 - uTime * 0.2) * 0.5 + 0.5 + 0.2);
    float foam = clamp(lip + band * 0.85, 0.0, 1.0);
    col = mix(col, vec3(0.97, 0.98, 0.96), foam);

    float fog = smoothstep(uFogNear, uFogFar, vViewDepth);
    col = mix(col, uFogColor, fog);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
