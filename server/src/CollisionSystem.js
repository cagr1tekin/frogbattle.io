import {
  BASE_RADIUS,
  FOOD_VALUE,
  KILL_RATIO,
  MAX_RADIUS,
  RADIUS_GROWTH,
} from '../../shared/constants.js';
import { clampPositionInCircle } from '../../shared/mapCircle.js';

/** Aynı tick içinde çoklu gövde için sınırlı tekrar. */
const FROG_SEPARATION_PASSES = 3;

/**
 * @param {import('./FrogEntity.js').FrogEntity} frog
 */
function clampFrogToMap(frog) {
  const p = clampPositionInCircle(frog.x, frog.y, frog.radius);
  frog.x = p.x;
  frog.y = p.y;
}

/**
 * Çakışan ama birbirini yiyemeyen kurbağaları iterler (yerinde mutasyon).
 * @param {import('./FrogEntity.js').FrogEntity[]} frogs
 */
function runFrogSeparation(frogs) {
  for (let pass = 0; pass < FROG_SEPARATION_PASSES; pass++) {
    for (let i = 0; i < frogs.length; i++) {
      const a = frogs[i];
      if (!a.isAlive) continue;
      for (let j = i + 1; j < frogs.length; j++) {
        const b = frogs[j];
        if (!b.isAlive) continue;

        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const overlap = a.radius + b.radius - dist;
        if (overlap <= 0) continue;

        if (a.canEat(b) || b.canEat(a)) continue;

        let nx;
        let ny;
        if (dist < 1e-6) {
          const angle = Math.random() * Math.PI * 2;
          nx = Math.cos(angle);
          ny = Math.sin(angle);
        } else {
          const inv = 1 / Math.max(dist, 0.01);
          nx = (b.x - a.x) * inv;
          ny = (b.y - a.y) * inv;
        }
        const push = overlap / 2 + 1;

        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;

        clampFrogToMap(a);
        clampFrogToMap(b);
      }
    }
  }
}

/** @param {import('./FrogEntity.js').FrogEntity[]} frogs */
export function checkFrogCollisions(frogs) {
  runFrogSeparation(frogs);
}

/**
 * Kurbağa–yem: skor +1, yarıçap güncelle, yem sil, rastgele yeni yem.
 * @param {import('./FrogEntity.js').FrogEntity[]} frogs
 * @param {import('./FoodManager.js').FoodManager} foodManager
 * @returns {{ removed: string[], added: Array<{ id: string; x: number; y: number; radius: number; color: string }> }}
 */
function runCheckFoodCollisions(frogs, foodManager) {
  /** @type {string[]} */
  const removed = [];
  /** @type {Array<{ id: string; x: number; y: number; radius: number; color: string }>} */
  const added = [];

  const foodEntries = [...foodManager.foods.entries()];

  for (const frog of frogs) {
    if (!frog.isAlive) continue;
    for (const [foodId, food] of foodEntries) {
      if (!foodManager.foods.has(foodId)) continue;

      const d = Math.hypot(frog.x - food.x, frog.y - food.y);
      if (d >= frog.radius + food.radius) continue;

      frog.score += FOOD_VALUE;
      frog.radius = Math.max(
        BASE_RADIUS,
        Math.min(MAX_RADIUS, BASE_RADIUS + frog.score * RADIUS_GROWTH),
      );

      foodManager.removeFood(food.id);
      const newFood = foodManager.spawnOne();
      removed.push(food.id);
      added.push({ ...newFood });
    }
  }

  return { removed, added };
}

/**
 * @param {import('./FrogEntity.js').FrogEntity[]} frogs
 * @param {import('./FoodManager.js').FoodManager} foodManager
 */
export function checkFoodCollisions(frogs, foodManager) {
  return runCheckFoodCollisions(frogs, foodManager);
}

/**
 * @param {import('./FrogEntity.js').FrogEntity} a
 * @param {import('./FrogEntity.js').FrogEntity} b
 * @param {Array<{ attackerId: string | number; victimId: string | number }>} eats
 */
function resolvePair(a, b, eats) {
  if (!a.isAlive || !b.isAlive) return false;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d >= a.radius + b.radius) return false;

  const aWins = a.canEat(b);
  const bWins = b.canEat(a);

  if (!aWins && !bWins) return false;

  /** @type {import('./FrogEntity.js').FrogEntity} */
  let predator;
  /** @type {import('./FrogEntity.js').FrogEntity} */
  let prey;

  if (aWins && !bWins) {
    predator = a;
    prey = b;
  } else if (!aWins && bWins) {
    predator = b;
    prey = a;
  } else {
    if (a.radius > b.radius) {
      predator = a;
      prey = b;
    } else if (b.radius > a.radius) {
      predator = b;
      prey = a;
    } else {
      predator = Math.random() < 0.5 ? a : b;
      prey = predator === a ? b : a;
    }
  }

  predator.score += prey.score * KILL_RATIO;
  prey.isAlive = false;
  eats.push({ attackerId: predator.id, victimId: prey.id });
  return true;
}

/**
 * Sadece kurbağa–kurbağa yeme.
 * @param {import('./FrogEntity.js').FrogEntity[]} frogs
 * @returns {{ eats: Array<{ attackerId: string | number; victimId: string | number }> }}
 */
function runCheckFrogCombat(frogs) {
  /** @type {Array<{ attackerId: string | number; victimId: string | number }>} */
  const eats = [];

  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < frogs.length; i++) {
      for (let j = i + 1; j < frogs.length; j++) {
        if (resolvePair(frogs[i], frogs[j], eats)) {
          progress = true;
          break;
        }
      }
      if (progress) break;
    }
  }

  return { eats };
}

/** @param {import('./FrogEntity.js').FrogEntity[]} frogs */
export function checkFrogCombat(frogs) {
  return runCheckFrogCombat(frogs);
}

/**
 * Canlı kurbağa — ölü gövde (corpse) yeme.
 * @param {import('./FrogEntity.js').FrogEntity[]} frogs
 * @param {Map<string | number, { id: string | number; x: number; y: number; radius: number; score: number }>} corpses
 * @returns {{ eatenCorpses: Array<{ eaterId: string | number; corpseId: string | number; bonus: number }> }}
 */
function runCheckCorpseCollisions(frogs, corpses) {
  /** @type {Array<{ eaterId: string | number; corpseId: string | number; bonus: number }>} */
  const eatenCorpses = [];

  for (const frog of frogs) {
    if (!frog.isAlive) continue;
    for (const [corpseId, corpse] of [...corpses.entries()]) {
      const d = Math.hypot(frog.x - corpse.x, frog.y - corpse.y);
      if (d >= frog.radius + corpse.radius) continue;

      const bonus = Math.floor(corpse.score * KILL_RATIO);
      frog.score += bonus;
      frog.radius = Math.max(
        BASE_RADIUS,
        Math.min(MAX_RADIUS, BASE_RADIUS + frog.score * RADIUS_GROWTH),
      );
      corpses.delete(corpseId);
      eatenCorpses.push({ eaterId: frog.id, corpseId, bonus });
    }
  }

  return { eatenCorpses };
}

export function checkCorpseCollisions(frogs, corpses) {
  return runCheckCorpseCollisions(frogs, corpses);
}

/**
 * Çarpışma kontrolü — itme ayrı; yem {@link checkFoodCollisions}; yeme {@link checkFrogCombat}.
 */
export class CollisionSystem {
  /**
   * @param {import('./FrogEntity.js').FrogEntity[]} frogs
   */
  checkFrogCollisions(frogs) {
    runFrogSeparation(frogs);
  }

  /**
   * @param {import('./FrogEntity.js').FrogEntity[]} frogs
   * @param {import('./FoodManager.js').FoodManager} foodManager
   */
  checkFoodCollisions(frogs, foodManager) {
    return runCheckFoodCollisions(frogs, foodManager);
  }

  /**
   * @param {import('./FrogEntity.js').FrogEntity[]} frogs
   */
  checkFrogCombat(frogs) {
    return runCheckFrogCombat(frogs);
  }

  /**
   * @param {import('./FrogEntity.js').FrogEntity[]} frogs
   * @param {Map<string | number, { id: string | number; x: number; y: number; radius: number; score: number }>} corpses
   */
  checkCorpseCollisions(frogs, corpses) {
    return runCheckCorpseCollisions(frogs, corpses);
  }
}
