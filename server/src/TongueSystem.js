import {
  TONGUE_EXTEND_MS,
  TONGUE_LENGTH_RATIO,
  TONGUE_OUT_MS,
  TONGUE_RETRACT_MS,
  TONGUE_TIP_RADIUS,
} from '../../shared/constants.js';

/**
 * Dil state güncellemesi ve dil / vücut çarpışma tespiti (sunucu authoritative).
 */
export class TongueSystem {
  /**
   * Tüm canlı kurbağaların dil state'ini güncelle.
   * @param {Map<string | number, import('./FrogEntity.js').FrogEntity>} frogMap
   * @param {number} deltaTime saniye
   * @param {Map<string | number, { tongueForce?: boolean }>} inputMap
   */
  updateAll(frogMap, deltaTime, inputMap) {
    const now = Date.now();
    for (const frog of frogMap.values()) {
      if (!frog.isAlive) continue;
      const forceOut = inputMap.get(frog.id)?.tongueForce ?? false;
      this._updateOne(frog, deltaTime, now, forceOut);
    }
  }

  /**
   * @param {import('./FrogEntity.js').FrogEntity} frog
   * @param {number} deltaTime
   * @param {number} now
   * @param {boolean} forceOut
   */
  _updateOne(frog, deltaTime, now, forceOut) {
    const t = frog.tongue;

    if (t.state === 'idle' && (forceOut || now >= t.nextAutoTime)) {
      t.state = 'extending';
      t.progress = 0;
      t.angle = frog.angle;
      t.lockedAngle = frog.angle;
      t.lockRotation = true;
      return;
    }

    if (t.state === 'extending') {
      t.progress += deltaTime / (TONGUE_EXTEND_MS / 1000);
      if (t.progress >= 1) {
        t.progress = 1;
        t.state = 'out';
        t.outTimer = 0;
      }
    } else if (t.state === 'out') {
      t.outTimer += deltaTime * 1000;
      if (t.outTimer >= TONGUE_OUT_MS) {
        t.state = 'retracting';
      }
    } else if (t.state === 'retracting') {
      t.progress -= deltaTime / (TONGUE_RETRACT_MS / 1000);
      if (t.progress <= 0) {
        t.progress = 0;
        t.state = 'idle';
        t.lockRotation = false;
        t.nextAutoTime = now + frog._randomTongueInterval();
      }
    }

    const len = frog.radius * TONGUE_LENGTH_RATIO * t.progress;
    t.tip.x =
      frog.x + Math.cos(t.angle) * (frog.radius * 0.7 + len);
    t.tip.y =
      frog.y + Math.sin(t.angle) * (frog.radius * 0.7 + len);
  }

  /**
   * @param {Map<string | number, import('./FrogEntity.js').FrogEntity>} frogMap
   * @returns {{
   *   tongueEats: Array<{ killer: string | number; victim: string | number; type: string }>;
   *   bodyCollisions: Array<{ a: string | number; b: string | number }>;
   * }}
   */
  checkCollisions(frogMap) {
    /** @type {Array<{ killer: string | number; victim: string | number; type: string }>} */
    const tongueEats = [];
    /** @type {Array<{ a: string | number; b: string | number }>} */
    const bodyCollisions = [];
    const alive = [...frogMap.values()].filter((f) => f.isAlive);
    const processed = new Set();

    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        const key = [String(a.id), String(b.id)].sort().join('-');
        if (processed.has(key)) continue;

        const result = this._checkPair(a, b);
        if (result) {
          if (result.type === 'body') {
            bodyCollisions.push({ a: a.id, b: b.id });
          } else {
            tongueEats.push(result);
          }
          processed.add(key);
        }
      }
    }
    return { tongueEats, bodyCollisions };
  }

  /**
   * @param {import('./FrogEntity.js').FrogEntity} a
   * @param {import('./FrogEntity.js').FrogEntity} b
   * @returns {{ killer: string | number; victim: string | number; type: string } | { type: 'body' } | null}
   */
  _checkPair(a, b) {
    const aTongueOut = a.tongue.state !== 'idle';
    const bTongueOut = b.tongue.state !== 'idle';

    if (aTongueOut) {
      const d = Math.hypot(a.tongue.tip.x - b.x, a.tongue.tip.y - b.y);
      if (d < b.radius + TONGUE_TIP_RADIUS) {
        return { killer: a.id, victim: b.id, type: 'tongue-vs-body' };
      }
    }

    if (bTongueOut) {
      const d = Math.hypot(b.tongue.tip.x - a.x, b.tongue.tip.y - a.y);
      if (d < a.radius + TONGUE_TIP_RADIUS) {
        return { killer: b.id, victim: a.id, type: 'tongue-vs-body' };
      }
    }

    if (aTongueOut && bTongueOut) {
      const d = Math.hypot(
        a.tongue.tip.x - b.tongue.tip.x,
        a.tongue.tip.y - b.tongue.tip.y,
      );
      if (d < TONGUE_TIP_RADIUS * 2) {
        const winner = a.radius >= b.radius ? a : b;
        const loser = a.radius >= b.radius ? b : a;
        return {
          killer: winner.id,
          victim: loser.id,
          type: 'tongue-vs-tongue',
        };
      }
    }

    if (!aTongueOut && !bTongueOut) {
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < a.radius + b.radius) {
        if (a.canEat(b) || b.canEat(a)) {
          return null;
        }
        if (!a.bodyCollisionCooldown && !b.bodyCollisionCooldown) {
          return { type: 'body' };
        }
      }
    }

    return null;
  }
}
