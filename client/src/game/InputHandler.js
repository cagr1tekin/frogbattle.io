/**
 * Fare pozisyonu → kurbağa açısı (canvas merkezine göre).
 * Space / sol tık → tongueForce (bir karelik tetik).
 */
export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;
    this.tongueForce = false;

    this._onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', this._onMove);

    this._onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.tongueForce = true;
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.tongueForce = true;
      }
    };
    canvas.addEventListener('mousedown', this._onMouseDown);
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

  /**
   * Bir kez true döner, sonra sıfırlanır.
   * @returns {boolean}
   */
  getTongueForce() {
    const v = this.tongueForce;
    this.tongueForce = false;
    return v;
  }
}
