import { TICK_RATE } from '../constants.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Sunucu snapshot'ları arasında kurbağa pozisyonu interpolasyonu.
 */
export class Interpolation {
  constructor() {
    /** @type {{ frogs: Array<Record<string, unknown>> }} */
    this.prevState = { frogs: [] };
    /** @type {{ frogs: Array<Record<string, unknown>> }} */
    this.currState = { frogs: [] };
    this.lastUpdateTime = 0;
    /** @type {Array<{ id: string; x: number; y: number; radius: number; color: string }>} */
    this.foods = [];
    /** @type {Array<{ id: string | number; x: number; y: number; radius: number; score?: number }>} */
    this.corpses = [];
  }

  /**
   * @param {{
   *   frogs: Array<Record<string, unknown>>;
   *   foods?: { added?: unknown[]; removed?: string[] };
   *   foodsFull?: Array<{ id: string; x: number; y: number; radius: number; color: string }>;
   *   corpses?: Array<{ id: string | number; x: number; y: number; radius: number; score?: number }>;
   * }} snapshot
   */
  update(snapshot) {
    this.prevState = { frogs: this._cloneFrogs(this.currState.frogs) };
    this.currState = {
      frogs: Array.isArray(snapshot.frogs) ? snapshot.frogs.map((f) => ({ ...f })) : [],
    };
    this.lastUpdateTime = performance.now();

    // Önce delta (küçük paket / unreliable senaryoda foodsFull gelmeyebilir).
    if (snapshot.foods && typeof snapshot.foods === 'object') {
      const added = snapshot.foods.added ?? [];
      const removed = new Set(snapshot.foods.removed ?? []);
      if (removed.size > 0 || added.length > 0) {
        this.foods = this.foods.filter((f) => !removed.has(f.id));
        for (const item of added) {
          if (item && typeof item === 'object' && 'id' in item) {
            const id = String(/** @type {{ id: unknown }} */ (item).id);
            if (!this.foods.some((f) => f.id === id)) {
              this.foods.push({ .../** @type {object} */ (item) });
            }
          }
        }
      }
    }
    // Tam liste varsa yetkili senk (her tick sunucu gönderiyor).
    if (Array.isArray(snapshot.foodsFull)) {
      this.foods = snapshot.foodsFull.map((f) => ({ ...f }));
    }

    if (Array.isArray(snapshot.corpses)) {
      this.corpses = snapshot.corpses.map((c) => ({ ...c }));
    }
  }

  /**
   * @param {Array<Record<string, unknown>>} frogs
   */
  _cloneFrogs(frogs) {
    return frogs.map((f) => ({ ...f }));
  }

  /**
   * @param {number} now performance.now veya Date.now
   * @returns {{
   *   frogs: Array<Record<string, unknown>>;
   *   foods: Array<{ id: string; x: number; y: number; radius: number; color: string }>;
   *   corpses: Array<{ id: string | number; x: number; y: number; radius: number; score?: number }>;
   * }}
   */
  getInterpolated(now) {
    const tickMs = 1000 / TICK_RATE;
    let alpha = (now - this.lastUpdateTime) / tickMs;
    alpha = Math.min(Math.max(alpha, 0), 1);

    const prevById = new Map(
      this.prevState.frogs.map((f) => [f.id, f]),
    );
    const curr = this.currState.frogs ?? [];

    const frogs = curr.map((cf) => {
      const pf = prevById.get(cf.id);
      if (!pf) {
        return { ...cf };
      }
      return {
        ...cf,
        x: lerp(Number(pf.x), Number(cf.x), alpha),
        y: lerp(Number(pf.y), Number(cf.y), alpha),
        radius: lerp(Number(pf.radius), Number(cf.radius), alpha),
        angle: Number(cf.angle),
      };
    });

    return { frogs, foods: this.foods, corpses: this.corpses };
  }
}
