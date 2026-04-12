import { FOOD_COUNT, FOOD_RADIUS, MAP_CENTER, MAP_RADIUS } from '../constants.js';

const FOOD_COLORS = ['#86efac', '#6ee7b7', '#34d399', '#a7f3d0'];

const FOOD_SPAWN_MARGIN = 50;

let _nextFoodId = 1;

function pickColor() {
  return FOOD_COLORS[(Math.random() * FOOD_COLORS.length) | 0];
}

/**
 * Harita yemleri: oluşturma ve eksik tamamlama.
 */
export class FoodManager {
  constructor() {
    /** @type {Array<{ id: string; x: number; y: number; radius: number; color: string }>} */
    this.foods = [];
  }

  /** @returns {{ id: string; x: number; y: number; radius: number; color: string }} */
  _createFood() {
    const maxR = Math.max(FOOD_RADIUS + 1, MAP_RADIUS - FOOD_SPAWN_MARGIN);
    const angle = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * maxR;
    const x = MAP_CENTER + Math.cos(angle) * rr;
    const y = MAP_CENTER + Math.sin(angle) * rr;
    return {
      id: `food_${_nextFoodId++}`,
      x,
      y,
      radius: FOOD_RADIUS,
      color: pickColor(),
    };
  }

  /** MAP_SIZE içinde FOOD_COUNT adet yem */
  init() {
    this.foods = [];
    this.spawn(FOOD_COUNT);
  }

  /**
   * Eksik yem varsa en fazla `count` adet ekler; toplam FOOD_COUNT'i aşmaz.
   * @param {number} [count=FOOD_COUNT]
   */
  spawn(count = FOOD_COUNT) {
    let added = 0;
    while (this.foods.length < FOOD_COUNT && added < count) {
      this.foods.push(this._createFood());
      added += 1;
    }
  }
}
