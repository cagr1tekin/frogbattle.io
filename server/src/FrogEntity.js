import {
  BASE_RADIUS,
  BASE_SPEED,
  EAT_RATIO,
  MAP_CENTER,
  MAP_RADIUS,
  MAX_RADIUS,
  RADIUS_GROWTH,
  SPEED_SCALE,
  SNEAK_ANGLE_THRESHOLD,
} from '../../shared/constants.js';

/**
 * Sunucu tarafı kurbağa — sabit hız; sınırda sadece pozisyon daire içine çekilir (açı/hız formülü değişmez).
 */
export class FrogEntity {
  /**
   * @param {string | number} id
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {string} [name]
   */
  constructor(id, x, y, color, name = 'Oyuncu') {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.score = 0;
    this.radius = BASE_RADIUS;
    this.color = color;
    this.isAlive = true;
  }

  /**
   * Bu kurbağa `other`'ı yiyebilir mi (boyut + sneak açısı).
   * @param {FrogEntity} other
   */
  canEat(other) {
    let angleDiff = Math.abs(this.angle - (other.angle + Math.PI)) % (Math.PI * 2);
    if (angleDiff > Math.PI) {
      angleDiff = Math.PI * 2 - angleDiff;
    }
    const isSneak = angleDiff < SNEAK_ANGLE_THRESHOLD;
    return this.radius > other.radius * EAT_RATIO || isSneak;
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

  toJSON() {
    return {
      id: this.id,
      name: this.name,
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
