import {
  CORPSE_LIFETIME,
  MAP_CENTER,
  MAP_RADIUS,
  TICK_RATE,
} from '../../shared/constants.js';
import { CollisionSystem } from './CollisionSystem.js';
import { FoodManager } from './FoodManager.js';
import { FrogEntity } from './FrogEntity.js';

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
 * Tek oda — yetkili sunucu döngüsü ve anlık durum yayını.
 */
export class GameRoom {
  constructor() {
    /** @type {Map<string | number, { channel: import('@geckos.io/server').ServerChannel; frog: FrogEntity; name: string }>} */
    this.players = new Map();
    this.foodManager = new FoodManager();
    this.collisionSystem = new CollisionSystem();
    this.foodManager.init();

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
  }

  /**
   * @param {string | number} channelId
   */
  removePlayer(channelId) {
    this.corpses.delete(channelId);
    this.players.delete(channelId);
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
   * @param {{ angle: number }} payload
   */
  onInput(channelId, payload) {
    const entry = this.players.get(channelId);
    if (!entry || !entry.frog.isAlive) return;
    if (typeof payload.angle === 'number') {
      entry.frog.angle = payload.angle;
    }
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

  tick() {
    const tickStart = Date.now();
    const dt = 1 / TICK_RATE;
    const now = Date.now();

    for (const [id, corpse] of this.corpses) {
      if (now - corpse.killedAt > CORPSE_LIFETIME) {
        this.corpses.delete(id);
      }
    }

    for (const { frog } of this.players.values()) {
      if (frog.isAlive) {
        frog.update(dt);
      }
    }

    const frogs = [...this.players.values()].map((p) => p.frog);
    // Önce itme → yem (sil + rastgele respawn + skor) → kurbağa yeme.
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
