import {
  BASE_RADIUS,
  BASE_SPEED,
  MAP_CENTER,
  MAP_RADIUS,
  MAX_RADIUS,
  RADIUS_GROWTH,
  SPEED_SCALE,
} from '../constants.js';

/**
 * Kurbağa durumu ve hareket — sınırda yalnızca pozisyon clamp; açı/hız formülü değişmez.
 */
export class FrogEntity {
  /**
   * @param {string | number} id
   * @param {number} x
   * @param {number} y
   * @param {string} color
   */
  constructor(id, x, y, color) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.score = 0;
    this.radius = BASE_RADIUS;
    this.color = color;
    this.isAlive = true;
  }

  /**
   * @param {number} deltaTime saniye
   */
  update(deltaTime) {
    const speed = BASE_SPEED / (1 + this.score * SPEED_SCALE);
    this.x += Math.cos(this.angle) * speed * deltaTime;
    this.y += Math.sin(this.angle) * speed * deltaTime;

    this.radius = Math.max(
      BASE_RADIUS,
      Math.min(MAX_RADIUS, BASE_RADIUS + this.score * RADIUS_GROWTH),
    );

    const dx = this.x - MAP_CENTER;
    const dy = this.y - MAP_CENTER;
    const distFromCenter = Math.hypot(dx, dy);
    const maxDist = MAP_RADIUS - this.radius;

    if (distFromCenter > maxDist) {
      const clampAngle = Math.atan2(dy, dx);
      this.x = MAP_CENTER + Math.cos(clampAngle) * maxDist;
      this.y = MAP_CENTER + Math.sin(clampAngle) * maxDist;
    }
  }

  /**
   * @returns {{ id: string | number; x: number; y: number; angle: number; radius: number; score: number; color: string; isAlive: boolean }}
   */
  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      angle: this.angle,
      radius: this.radius,
      score: this.score,
      color: this.color,
      isAlive: this.isAlive,
    };
  }
}
