/**
 * Fare pozisyonu → kurbağa açısı (canvas merkezine göre).
 */
export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;
    this._onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', this._onMove);
  }

  /**
   * Canvas merkezine göre hedef açı (radyan).
   * Fare canvas dışında veya köşede olsa bile kısıtlanmaz; sınırda kayma sunucu/physics clamp ile olur.
   * @returns {number}
   */
  getAngle() {
    return Math.atan2(
      this.mouseY - this.canvas.height / 2,
      this.mouseX - this.canvas.width / 2,
    );
  }
}
