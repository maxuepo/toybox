/** A tiny tween runner: enough for pop-ins and bobbing without pulling in a library. */

interface Tween {
  start: number;
  duration: number;
  step: (k: number) => void;
  resolve: () => void;
}

export const easeOutBack = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

export const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);

export class Tweens {
  private list: Tween[] = [];
  private now = 0;

  /** Runs `step(k)` with k going 0 → 1 over `duration` seconds, after `delay`. */
  add(duration: number, step: (k: number) => void, delay = 0): Promise<void> {
    step(0);
    return new Promise((resolve) => {
      this.list.push({ start: this.now + delay, duration, step, resolve });
    });
  }

  update(now: number) {
    this.now = now;
    this.list = this.list.filter((t) => {
      const k = Math.min(1, Math.max(0, (now - t.start) / t.duration));
      if (now >= t.start) t.step(k);
      if (k >= 1) t.resolve();
      return k < 1;
    });
  }
}

/** Deterministic RNG so a tile looks the same every time it's rebuilt. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hexSeed = (q: number, r: number) => (q * 73856093) ^ (r * 19349663);
