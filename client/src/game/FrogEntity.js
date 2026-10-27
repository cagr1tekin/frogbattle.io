import {
  BASE_RADIUS,
  BASE_SPEED,
  MAP_CENTER,
  MAP_RADIUS,
  MAX_RADIUS,
  RADIUS_GROWTH,
  SPEED_SCALE,
  TONGUE_INTERVAL_MAX,
  TONGUE_INTERVAL_MIN,
  TURN_SPEED_BASE,
  TURN_SPEED_SCALE,
} from '../constants.js';

/**
 * Kurbağa durumu ve hareket — skora bağlı dönüş; sınırda pozisyon clamp.
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
    this.targetAngle = this.angle;
    this.score = 0;
    this.radius = BASE_RADIUS;
    this.color = color;
    this.isAlive = true;

    this.tongue = {
      state: 'idle',
      progress: 0,
      angle: 0,
      lockedAngle: this.angle,
      lockRotation: false,
      nextAutoTime: 0,
      tip: { x, y },
      outTimer: 0,
    };
    this.tongue.nextAutoTime = Date.now() + this._randomTongueInterval();
    this.bodyCollisionCooldown = 0;
  }

  _randomTongueInterval() {
    return (
      TONGUE_INTERVAL_MIN +
      Math.random() * (TONGUE_INTERVAL_MAX - TONGUE_INTERVAL_MIN)
    );
  }

  /**
   * @param {number} deltaTime saniye
   */
  update(deltaTime) {
    if (this.bodyCollisionCooldown > 0) {
      this.bodyCollisionCooldown = Math.max(
        0,
        this.bodyCollisionCooldown - deltaTime * 1000,
      );
    }

    if (this.tongue && this.tongue.lockRotation) {
      this.angle = this.tongue.lockedAngle;
    } else {
      const turnSpeed =
        TURN_SPEED_BASE / (1 + this.score * TURN_SPEED_SCALE);
      let delta = this.targetAngle - this.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const maxTurn = turnSpeed * deltaTime;
      this.angle +=
        Math.sign(delta) * Math.min(Math.abs(delta), maxTurn);
    }

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

    // Çok oyunculu dil ucu sunucu snapshot / applySnapshot ile gelir; idle iken ağızda tut.
    if (this.tongue.state === 'idle') {
      this.tongue.tip.x = this.x;
      this.tongue.tip.y = this.y;
    }
  }

  /**
   * Sunucu snapshot veya teşhis senkronu — çok oyunculu görsel ile uyum (interpolation ana yol).
   * @param {{
   *   x: number;
   *   y: number;
   *   angle: number;
   *   radius: number;
   *   score: number;
   *   tongue?: {
   *     state?: string;
   *     progress?: number;
   *     angle?: number;
   *     tip?: { x: number; y: number };
   *     lockRotation?: boolean;
   *     lockedAngle?: number;
   *     nextAutoTime?: number;
   *     outTimer?: number;
   *   };
   *   targetAngle?: number;
   *   isAlive?: boolean;
   * }} data
   */
  applySnapshot(data) {
    this.x = data.x;
    this.y = data.y;
    this.angle = data.angle;
    if (typeof data.targetAngle === 'number') {
      this.targetAngle = data.targetAngle;
    } else {
      this.targetAngle = data.angle;
    }
    this.radius = data.radius;
    this.score = data.score;
    if (typeof data.isAlive === 'boolean') {
      this.isAlive = data.isAlive;
    }
    if (data.tongue && typeof data.tongue === 'object') {
      const t = data.tongue;
      if (typeof t.state === 'string') this.tongue.state = t.state;
      if (typeof t.progress === 'number') this.tongue.progress = t.progress;
      if (typeof t.angle === 'number') this.tongue.angle = t.angle;
      if (t.tip && typeof t.tip.x === 'number' && typeof t.tip.y === 'number') {
        this.tongue.tip = { x: t.tip.x, y: t.tip.y };
      }
      if (typeof t.lockRotation === 'boolean') {
        this.tongue.lockRotation = t.lockRotation;
      }
      if (typeof t.lockedAngle === 'number') {
        this.tongue.lockedAngle = t.lockedAngle;
      }
      if (typeof t.outTimer === 'number') {
        this.tongue.outTimer = t.outTimer;
      }
      if (typeof t.nextAutoTime === 'number') {
        this.tongue.nextAutoTime = t.nextAutoTime;
      }
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
