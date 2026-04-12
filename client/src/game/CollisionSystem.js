import {
  EAT_RATIO,
  FOOD_VALUE,
  KILL_RATIO,
  SNEAK_ANGLE_THRESHOLD,
} from '../constants.js';

/**
 * @param {import('./FrogEntity.js').FrogEntity} attacker
 * @param {import('./FrogEntity.js').FrogEntity} victim
 */
function canEat(attacker, victim) {
  let angleDiff = Math.abs(attacker.angle - (victim.angle + Math.PI)) % (Math.PI * 2);
  if (angleDiff > Math.PI) {
    angleDiff = Math.PI * 2 - angleDiff;
  }
  const isSneak = angleDiff < SNEAK_ANGLE_THRESHOLD;
  return attacker.radius > victim.radius * EAT_RATIO || isSneak;
}

/**
 * Yem çarpışması: içinde kalan yemleri listeden çıkarır, skoru artırır.
 * @param {import('./FrogEntity.js').FrogEntity} frog
 * @param {Array<{ id: string; x: number; y: number; radius: number; color?: string }>} foods
 * @returns {{ eatenIds: string[]; eatenForFx: Array<{ x: number; y: number; color: string }> }}
 */
export function checkFoodCollisions(frog, foods) {
  const eatenIds = [];
  /** @type {Array<{ x: number; y: number; color: string }>} */
  const eatenForFx = [];
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    const d = Math.hypot(frog.x - food.x, frog.y - food.y);
    if (d < frog.radius + food.radius) {
      eatenIds.push(food.id);
      eatenForFx.push({
        x: food.x,
        y: food.y,
        color: food.color ?? '#86efac',
      });
      frog.score += FOOD_VALUE;
      foods.splice(i, 1);
    }
  }
  return { eatenIds, eatenForFx };
}

/**
 * Oyuncu vs diğer kurbağalar (Bölüm 6 yeme kuralları).
 * @param {import('./FrogEntity.js').FrogEntity} playerFrog
 * @param {import('./FrogEntity.js').FrogEntity[]} otherFrogs
 * @returns {{ eaten: boolean; victimId: string | number | null }}
 */
export function checkFrogCollisions(playerFrog, otherFrogs) {
  if (!playerFrog.isAlive) {
    return { eaten: false, victimId: null };
  }

  for (let i = otherFrogs.length - 1; i >= 0; i--) {
    const other = otherFrogs[i];
    if (!other.isAlive) continue;

    const d = Math.hypot(playerFrog.x - other.x, playerFrog.y - other.y);
    if (d >= playerFrog.radius + other.radius) continue;

    const playerWins = canEat(playerFrog, other);
    const otherWins = canEat(other, playerFrog);

    let winner = null;
    if (playerWins && !otherWins) winner = 'player';
    else if (!playerWins && otherWins) winner = 'other';
    else if (playerWins && otherWins) {
      if (playerFrog.radius > other.radius) winner = 'player';
      else if (other.radius > playerFrog.radius) winner = 'other';
      else winner = Math.random() < 0.5 ? 'player' : 'other';
    }

    if (winner === 'player') {
      playerFrog.score += other.score * KILL_RATIO;
      otherFrogs.splice(i, 1);
      return { eaten: true, victimId: other.id };
    }
    if (winner === 'other') {
      playerFrog.isAlive = false;
      return { eaten: true, victimId: playerFrog.id };
    }
  }

  return { eaten: false, victimId: null };
}
