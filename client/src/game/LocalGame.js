import {
  BASE_RADIUS,
  FOOD_PARTICLE_MAX,
  FOOD_PARTICLE_MIN,
  MAP_CENTER,
  MAP_RADIUS,
} from '../constants.js';
import { debugFlags } from '../debugFlags.js';
import { checkFoodCollisions, checkFrogCollisions } from './CollisionSystem.js';
import { FoodManager } from './FoodManager.js';
import { FrogEntity } from './FrogEntity.js';
import { InputHandler } from './InputHandler.js';
import { Particle } from './Particle.js';

const AI_COUNT = 4;
const AI_ANGLE_REPICK = 0.85;

function randomParticleCount() {
  return FOOD_PARTICLE_MIN + Math.floor(Math.random() * (FOOD_PARTICLE_MAX - FOOD_PARTICLE_MIN + 1));
}

/**
 * Faz 1 — sunucusuz oyun durumu ve güncelleme.
 */
export class LocalGame {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.inputHandler = new InputHandler(canvas);
    this.foodManager = new FoodManager();
    this.foodManager.init();

    this.playerFrog = new FrogEntity('local', MAP_CENTER, MAP_CENTER, '#4ade80');

    /** @type {FrogEntity[]} */
    this.aiFrogs = [];
    for (let i = 0; i < AI_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (MAP_RADIUS * 0.8);
      const x = MAP_CENTER + Math.cos(angle) * dist;
      const y = MAP_CENTER + Math.sin(angle) * dist;
      const bot = new FrogEntity(`bot_${i + 1}`, x, y, '#f472b6');
      bot.angle = Math.random() * Math.PI * 2;
      bot.targetAngle = bot.angle;
      this.aiFrogs.push(bot);
    }

    /** @type {{ bgStart: string; bgEnd: string; grid: string }} */
    this.theme = {
      bgStart: '#1a3a1a',
      bgEnd: '#2D5A27',
      grid: '#52B788',
    };

    /** @type {number[]} */
    this._aiTimers = this.aiFrogs.map(() => 0);

    /** @type {Particle[]} */
    this.particles = [];
  }

  /**
   * Oyuncuyu harita ortasına alır, skoru sıfırlar.
   */
  respawnPlayer() {
    this.playerFrog.x = MAP_CENTER;
    this.playerFrog.y = MAP_CENTER;
    this.playerFrog.score = 0;
    this.playerFrog.radius = BASE_RADIUS;
    this.playerFrog.angle = -Math.PI / 2;
    this.playerFrog.targetAngle = this.playerFrog.angle;
    this.playerFrog.isAlive = true;
  }

  /**
   * @param {number} deltaTime saniye
   */
  update(deltaTime) {
    if (this.playerFrog.isAlive) {
      this.playerFrog.targetAngle = this.inputHandler.getAngle();
      this.playerFrog.update(deltaTime);
    }

    this.foodManager.spawn();

    if (this.playerFrog.isAlive) {
      const { eatenForFx } = checkFoodCollisions(
        this.playerFrog,
        this.foodManager.foods,
      );
      for (const fx of eatenForFx) {
        const n = randomParticleCount();
        for (let i = 0; i < n; i++) {
          this.particles.push(new Particle(fx.x, fx.y, fx.color));
        }
      }
    }

    this.particles = this.particles.filter((p) => p.update(deltaTime));

    for (let i = 0; i < this.aiFrogs.length; i++) {
      const bot = this.aiFrogs[i];
      if (!bot.isAlive) continue;
      this._aiTimers[i] += deltaTime;
      if (this._aiTimers[i] >= AI_ANGLE_REPICK) {
        this._aiTimers[i] = 0;
        bot.targetAngle += (Math.random() - 0.5) * 1.2;
      }
      bot.update(deltaTime);
    }

    if (this.playerFrog.isAlive) {
      checkFrogCollisions(this.playerFrog, this.aiFrogs);
    }
  }

  /**
   * @returns {{
   *   playerFrog: FrogEntity;
   *   foods: Array<{ id: string; x: number; y: number; radius: number; color: string }>;
   *   frogs: FrogEntity[];
   *   theme: { bgStart: string; bgEnd: string; grid: string };
   *   myId: string | number;
   *   particles: Particle[];
   *   debugMode: boolean;
   * }}
   */
  getState() {
    const frogs = [this.playerFrog, ...this.aiFrogs].filter((f) => f.isAlive);
    return {
      playerFrog: this.playerFrog,
      foods: this.foodManager.foods,
      frogs,
      theme: this.theme,
      myId: this.playerFrog.id,
      particles: this.particles,
      corpses: [],
      debugMode: debugFlags.showDebugOverlay,
    };
  }
}
