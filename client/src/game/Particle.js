import { FOOD_PARTICLE_LIFE_MS } from '../constants.js';

/**
 * Yem patlaması parçacığı (dünya koordinatı).
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} alpha
 * @property {string} color
 */
export class Particle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} color
   */
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const a = Math.random() * Math.PI * 2;
    const sp = 100 + Math.random() * 140;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.alpha = 1;
    this.color = color;
    this._life = 0;
    this._maxLife = FOOD_PARTICLE_LIFE_MS / 1000;
  }

  /**
   * @param {number} deltaTime saniye
   * @returns {boolean} hâlâ yaşıyor mu
   */
  update(deltaTime) {
    this._life += deltaTime;
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.alpha = Math.max(0, 1 - this._life / this._maxLife);
    return this._life < this._maxLife && this.alpha > 0.01;
  }
}
