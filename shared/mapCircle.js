import { MAP_CENTER, MAP_RADIUS } from './constants.js';

/**
 * (x,y) noktasını daire içinde tutar: merkeze uzaklık + yarıçap ≤ MAP_RADIUS.
 * @param {number} x
 * @param {number} y
 * @param {number} entityRadius
 * @returns {{ x: number; y: number }}
 */
export function clampPositionInCircle(x, y, entityRadius) {
  const dx = x - MAP_CENTER;
  const dy = y - MAP_CENTER;
  const d = Math.hypot(dx, dy);
  const maxD = MAP_RADIUS - entityRadius;
  if (maxD <= 0) {
    return { x: MAP_CENTER, y: MAP_CENTER };
  }
  if (d <= maxD) {
    return { x, y };
  }
  const s = maxD / d;
  return { x: MAP_CENTER + dx * s, y: MAP_CENTER + dy * s };
}
