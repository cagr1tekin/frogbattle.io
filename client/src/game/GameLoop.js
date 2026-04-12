import { DELTA_TIME_CAP } from '../constants.js';

/**
 * requestAnimationFrame tabanlı oyun döngüsü: update(dt) → render().
 * FPS: her karede delta’ya göre üstel ortalama (hafif yumuşatma).
 */
export class GameLoop {
  /**
   * @param {{ update: (deltaTime: number) => void; render: () => void }} hooks
   */
  constructor(hooks) {
    this.update = hooks.update;
    this.render = hooks.render;
    this._running = false;
    this._rafId = 0;
    this._lastTime = 0;
    /** Son 1 saniyedeki tam kare sayısı (debug HUD) */
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this.lastFpsTime = this._lastTime;
    const tick = (now) => {
      if (!this._running) return;
      let deltaTime = (now - this._lastTime) / 1000;
      this._lastTime = now;
      deltaTime = Math.min(deltaTime, DELTA_TIME_CAP);

      this.update(deltaTime);
      this.render();

      this.frameCount += 1;
      if (now - this.lastFpsTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsTime = now;
      }

      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._rafId);
  }
}
