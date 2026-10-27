import {
  BASE_RADIUS,
  BODY_COLLISION_COOLDOWN,
  BODY_COLLISION_PENALTY,
  CORPSE_LIFETIME,
  KILL_RATIO,
  MAP_CENTER,
  MAP_RADIUS,
  MAX_RADIUS,
  RADIUS_GROWTH,
  TICK_RATE,
} from '../../shared/constants.js';
import { CollisionSystem } from './CollisionSystem.js';
import { FoodManager } from './FoodManager.js';
import { FrogEntity } from './FrogEntity.js';
import { TongueSystem } from './TongueSystem.js';

const PLAYER_COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#2dd4bf'];

function randomSpawn() {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * (MAP_RADIUS * 0.8);
  return {
    x: MAP_CENTER + Math.cos(angle) * dist,
    y: MAP_CENTER + Math.sin(angle) * dist,
  };
}

function pickPlayerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

/**
 * @param {number} score
 */
function calcRadius(score) {
  return Math.max(
    BASE_RADIUS,
    Math.min(MAX_RADIUS, BASE_RADIUS + score * RADIUS_GROWTH),
  );
}

/**
 * Tek oda — yetkili sunucu döngüsü ve anlık durum yayını.
 */
export class GameRoom {
  constructor() {
    /** @type {Map<string | number, { channel: import('@geckos.io/server').ServerChannel; frog: FrogEntity; name: string }>} */
    this.players = new Map();
    this.foodManager = new FoodManager();
    this.collisionSystem = new CollisionSystem();
    this.tongueSystem = new TongueSystem();
    this.foodManager.init();

    /** @type {Map<string | number, { tongueForce: boolean }>} */
    this.inputMap = new Map();

    /** @type {ReturnType<typeof setInterval> | null} */
    this._tickInterval = null;
    this._gameEnded = false;
    this._playerColorIndex = 0;

    /**
     * Ölü kurbağalar — yenilenebilir gövde.
     * @type {Map<string | number, { id: string | number; x: number; y: number; radius: number; score: number; killedAt: number }>}
     */
    this.corpses = new Map();
  }

  /**
   * @param {import('@geckos.io/server').ServerChannel} channel
   * @param {string} name
   */
  addPlayer(channel, name) {
    const channelId = channel.id;
    const { x, y } = randomSpawn();
    const color = pickPlayerColor(this._playerColorIndex++);
    const frog = new FrogEntity(channelId, x, y, color, name);
    this.players.set(channelId, { channel, frog, name });
    this.inputMap.set(channelId, { tongueForce: false });
  }

  /**
   * @param {string | number} channelId
   */
  removePlayer(channelId) {
    this.corpses.delete(channelId);
    this.players.delete(channelId);
    this.inputMap.delete(channelId);
    if (this.players.size < 2) {
      this.stopLoop();
      this._gameEnded = false;
    }
  }

  /** Oyun döngüsü çalışıyor mu (lobby: 2+ oyuncuda başlar). */
  get isRunning() {
    return this._tickInterval !== null;
  }

  /** Yeni maç öncesi (isteğe bağlı sıfırlama). */
  resetMatchState() {
    this._gameEnded = false;
  }

  /**
   * @param {string | number} channelId
   * @param {{ angle?: number; tongueForce?: boolean }} payload
   */
  onInput(channelId, payload) {
    const entry = this.players.get(channelId);
    if (!entry || !entry.frog.isAlive) return;
    if (typeof payload.angle === 'number') {
      entry.frog.targetAngle = payload.angle;
    }
    const cur = this.inputMap.get(channelId) ?? { tongueForce: false };
    this.inputMap.set(channelId, {
      tongueForce: cur.tongueForce || !!payload.tongueForce,
    });
  }

  startLoop() {
    if (this._tickInterval !== null) return;
    const ms = 1000 / TICK_RATE;
    this._tickInterval = setInterval(() => this.tick(), ms);
  }

  stopLoop() {
    if (this._tickInterval !== null) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  /**
   * @param {string} event
   * @param {unknown} data
   */
  _broadcastReliable(event, data) {
    for (const { channel } of this.players.values()) {
      channel.emit(event, data, { reliable: true });
    }
  }

  /**
   * @param {FrogEntity} victim
   */
  _killFrog(victim) {
    if (!victim.isAlive) return;
    victim.isAlive = false;
    const now = Date.now();
    this.corpses.set(victim.id, {
      id: victim.id,
      x: victim.x,
      y: victim.y,
      radius: victim.radius,
      score: victim.score,
      killedAt: now,
    });
  }

  tick() {
    const tickStart = Date.now();
    const dt = 1 / TICK_RATE;
    const now = Date.now();

    for (const [id, corpse] of this.corpses) {
      if (now - corpse.killedAt > CORPSE_LIFETIME) {
        this.corpses.delete(id);
      }
    }

    /** @type {Map<string | number, FrogEntity>} */
    const frogMap = new Map();
    for (const [id, entry] of this.players) {
      frogMap.set(id, entry.frog);
    }

    for (const { frog } of this.players.values()) {
      if (frog.isAlive) {
        frog.update(dt);
      }
    }

    this.tongueSystem.updateAll(frogMap, dt, this.inputMap);
    const tongueResults = this.tongueSystem.checkCollisions(frogMap);

    for (const { killer, victim, type } of tongueResults.tongueEats) {
      const killerEntry = this.players.get(killer);
      const victimEntry = this.players.get(victim);
      const killerFrog = killerEntry?.frog;
      const victimFrog = victimEntry?.frog;
      if (
        !killerFrog ||
        !victimFrog ||
        !killerFrog.isAlive ||
        !victimFrog.isAlive
      ) {
        continue;
      }
      killerFrog.score += Math.floor(victimFrog.score * KILL_RATIO);
      killerFrog.radius = calcRadius(killerFrog.score);
      this._killFrog(victimFrog);
      this._broadcastReliable('game:tongueEat', { killer, victim, type });
    }

    for (const { a: aId, b: bId } of tongueResults.bodyCollisions) {
      const a = frogMap.get(aId);
      const b = frogMap.get(bId);
      if (!a || !b || !a.isAlive || !b.isAlive) continue;
      a.score = Math.max(0, Math.floor(a.score * (1 - BODY_COLLISION_PENALTY)));
      b.score = Math.max(0, Math.floor(b.score * (1 - BODY_COLLISION_PENALTY)));
      a.radius = calcRadius(a.score);
      b.radius = calcRadius(b.score);
      a.bodyCollisionCooldown = BODY_COLLISION_COOLDOWN;
      b.bodyCollisionCooldown = BODY_COLLISION_COOLDOWN;
      this._broadcastReliable('effect:poison', { ids: [aId, bId] });
      this._broadcastReliable('game:bodyCollision', {
        a: aId,
        b: bId,
        penaltyA: a.score,
        penaltyB: b.score,
      });
    }

    for (const id of this.players.keys()) {
      const cur = this.inputMap.get(id);
      if (cur) {
        this.inputMap.set(id, { tongueForce: false });
      }
    }

    const frogs = [...this.players.values()].map((p) => p.frog);

    this.collisionSystem.checkFrogCollisions(frogs);
    const { removed, added } = this.collisionSystem.checkFoodCollisions(
      frogs,
      this.foodManager,
    );
    const { eats } = this.collisionSystem.checkFrogCombat(frogs);
    for (const { victimId } of eats) {
      const entry = this.players.get(victimId);
      if (!entry) continue;
      const v = entry.frog;
      if (!v.isAlive) {
        this.corpses.set(victimId, {
          id: victimId,
          x: v.x,
          y: v.y,
          radius: v.radius,
          score: v.score,
          killedAt: now,
        });
      }
    }

    const { eatenCorpses } = this.collisionSystem.checkCorpseCollisions(
      frogs,
      this.corpses,
    );
    if (eatenCorpses.length > 0) {
      for (const { channel } of this.players.values()) {
        for (const ev of eatenCorpses) {
          channel.emit('game:corpseEaten', ev, { reliable: true });
        }
      }
    }

    const snapshot = {
      frogs: frogs
        .filter((f) => f.isAlive)
        .map((f) => ({
          id: f.id,
          x: f.x,
          y: f.y,
          angle: f.angle,
          radius: f.radius,
          score: f.score,
          color: f.color,
          name: f.name,
          tongue: {
            state: f.tongue.state,
            progress: f.tongue.progress,
            angle: f.tongue.angle,
            tip: { x: f.tongue.tip.x, y: f.tongue.tip.y },
          },
        })),
      foods: { added, removed },
      foodsFull: this.foodManager.getFoodsList().map((f) => ({ ...f })),
      corpses: [...this.corpses.values()].map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        radius: c.radius,
        score: c.score,
      })),
    };

    for (const { channel } of this.players.values()) {
      channel.emit('state', snapshot, { reliable: false });
    }

    const alive = frogs.filter((f) => f.isAlive);
    if (!this._gameEnded && this.players.size >= 2 && alive.length === 1) {
      this._gameEnded = true;
      const winnerId = alive[0].id;
      for (const { channel } of this.players.values()) {
        channel.emit('game:end', { winnerId }, { reliable: true });
      }
      this.stopLoop();
    }

    const tickDuration = Date.now() - tickStart;
    if (tickDuration > 40) {
      console.warn('Yavaş tick:', `${tickDuration}ms`);
    }
  }
}
