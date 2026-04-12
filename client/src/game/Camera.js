import { CAMERA_LERP_SPEED, CAMERA_ZOOM_SCORE_FACTOR } from '../constants.js';

/**
 * Kuzeye sabit kamera: dünya translate + scale; asla rotate yok.
 */
export class Camera {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;
    this.scale = 1;
    this.x = 0;
    this.y = 0;
  }

  /**
   * Oyuncuyu ekran merkezine hizalar (lerp) ve skora göre zoom uygular.
   * @param {{ x: number; y: number; score: number }} frog
   * @param {number} deltaTime saniye
   */
  update(frog, deltaTime) {
    const targetX = frog.x;
    const targetY = frog.y;
    this.x += (targetX - this.x) * CAMERA_LERP_SPEED * deltaTime;
    this.y += (targetY - this.y) * CAMERA_LERP_SPEED * deltaTime;
    this.scale = 1 / (1 + frog.score * CAMERA_ZOOM_SCORE_FACTOR);
  }

  /**
   * Anında hedefe kilitlenir (respawn vb.).
   * @param {{ x: number; y: number; score: number }} frog
   */
  snapTo(frog) {
    this.x = frog.x;
    this.y = frog.y;
    this.scale = 1 / (1 + frog.score * CAMERA_ZOOM_SCORE_FACTOR);
  }

  /**
   * Dünya koordinat sistemini uygular; rotate çağrılmaz.
   * @param {CanvasRenderingContext2D} ctx
   */
  apply(ctx) {
    ctx.save();
    const ox = this.canvas.width / 2 - this.x * this.scale;
    const oy = this.canvas.height / 2 - this.y * this.scale;
    ctx.translate(ox, oy);
    ctx.scale(this.scale, this.scale);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  restore(ctx) {
    ctx.restore();
  }

  /**
   * Dünya (x, y) → ekran pikseli.
   * @param {number} x
   * @param {number} y
   * @returns {{ sx: number; sy: number }}
   */
  worldToScreen(x, y) {
    const sx = this.canvas.width / 2 + (x - this.x) * this.scale;
    const sy = this.canvas.height / 2 + (y - this.y) * this.scale;
    return { sx, sy };
  }
}
