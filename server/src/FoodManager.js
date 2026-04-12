import {
  FOOD_COUNT,
  FOOD_RADIUS,
  MAP_CENTER,
  MAP_RADIUS,
} from '../../shared/constants.js';

const FOOD_COLORS = ['#86efac', '#6ee7b7', '#34d399', '#a7f3d0'];

/** Sınır halkasından iç pay (px). */
const FOOD_SPAWN_MARGIN = 50;

function pickColor() {
  return FOOD_COLORS[(Math.random() * FOOD_COLORS.length) | 0];
}

/**
 * Sunucu yem deposu — Map(id → yem); silme + rastgele respawn.
 */
export class FoodManager {
  constructor() {
    /** @type {Map<string, { id: string; x: number; y: number; radius: number; color: string }>} */
    this.foods = new Map();
  }

  /**
   * Çarpışma / snapshot için dizi kopyası.
   * @returns {Array<{ id: string; x: number; y: number; radius: number; color: string }>}
   */
  getFoodsList() {
    return [...this.foods.values()];
  }

  /**
   * @param {string} id
   */
  removeFood(id) {
    this.foods.delete(id);
  }

  /**
   * Harita merkezine göre daire içinde rastgele konum, kare sınıra clamp.
   * @returns {{ id: string; x: number; y: number; radius: number; color: string }}
   */
  spawnOne() {
    const maxR = Math.max(FOOD_RADIUS + 1, MAP_RADIUS - FOOD_SPAWN_MARGIN);
    const angle = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * maxR;
    const x = MAP_CENTER + Math.cos(angle) * rr;
    const y = MAP_CENTER + Math.sin(angle) * rr;

    const food = {
      id: crypto.randomUUID(),
      x,
      y,
      radius: FOOD_RADIUS,
      color: pickColor(),
    };
    this.foods.set(food.id, food);
    return food;
  }

  init() {
    this.foods.clear();
    this.spawn(FOOD_COUNT);
  }

  /**
   * @param {number} [count=FOOD_COUNT]
   */
  spawn(count = FOOD_COUNT) {
    let added = 0;
    while (this.foods.size < FOOD_COUNT && added < count) {
      this.spawnOne();
      added += 1;
    }
  }
}
