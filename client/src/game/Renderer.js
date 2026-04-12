import {
  CORPSE_OPACITY,
  FOOD_GLOW_BLUR,
  FOOD_RADIUS,
  GRID_CELL_SIZE,
  GRID_OPACITY,
  JUMP_AMPLITUDE,
  JUMP_HEIGHT,
  JUMP_PERIOD,
  MAP_BORDER_SHADOW_BLUR,
  MAP_BORDER_WIDTH,
  MAP_CENTER,
  MAP_RADIUS,
  MAP_SIZE,
} from '../constants.js';
import frogDeadSpriteUrl from '../../assets/sprites/frog-dead.png?url';
import frogSpriteUrl from '../../assets/sprites/frog-default.png?url';

/**
 * Canvas 2D çizim — Bölüm 8 render sırası.
 */
export class Renderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   */
  constructor(ctx, canvas) {
    this.ctx = ctx;
    this.canvas = canvas;
    this._frogImage = new Image();
    this._frogImage.src = frogSpriteUrl;
    this._deadFrogImage = new Image();
    this._deadFrogImage.src = frogDeadSpriteUrl;

    /** @type {OffscreenCanvas | HTMLCanvasElement} */
    this._bgCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(MAP_SIZE, MAP_SIZE)
        : (() => {
            const c = document.createElement('canvas');
            c.width = MAP_SIZE;
            c.height = MAP_SIZE;
            return c;
          })();
    /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null} */
    this._bgCtx = this._bgCanvas.getContext('2d');
    this._bgDirty = true;
    /** @type {string} */
    this._cachedBgThemeKey = '';

    /** @type {string} */
    this._frogSortKey = '';
    /**
     * Büyükten küçüğe çizim sırası — sadece id; pozisyon her kare `frogs` ile yeniden çözülür
     * (eski nesne referansı tutmak diğer oyuncuyu donuk gösteriyordu).
     * @type {Array<string | number>}
     */
    this._frogDrawOrderIds = [];
  }

  /**
   * Dünya (x,y) ekranda görünür mü (genişletilmiş dikdörtgen, px).
   * @param {number} x
   * @param {number} y
   * @param {number} radius dünya birimi
   * @param {import('./Camera.js').Camera} camera
   */
  isInViewport(x, y, radius, camera) {
    const { sx, sy } = camera.worldToScreen(x, y);
    const sr = radius * camera.scale;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const m = 50;
    return (
      sx + sr > -m &&
      sx - sr < w + m &&
      sy + sr > -m &&
      sy - sr < h + m
    );
  }

  /**
   * Harita teması değişince arka plan önbelleğini yenile.
   */
  invalidateBackground() {
    this._bgDirty = true;
  }

  /**
   * @param {{
   *   theme: { bgStart: string; bgEnd: string; grid: string };
   *   foods: Array<{ x: number; y: number; radius?: number; color?: string }>;
   *   frogs: Array<{ id: string | number; x: number; y: number; radius: number; angle: number; score?: number; color?: string; name?: string }>;
   *   myId: string | number;
   *   particles?: import('./Particle.js').Particle[];
   *   corpses?: unknown[];
   *   debugMode?: boolean;
   *   multiplayer?: boolean;
   * }} gameState
   * @param {import('./Camera.js').Camera} camera
   */
  render(gameState, camera) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    camera.apply(ctx);

    ctx.fillStyle = '#111111';
    ctx.fillRect(-5000, -5000, 14000, 14000);

    ctx.save();
    ctx.beginPath();
    ctx.arc(MAP_CENTER, MAP_CENTER, MAP_RADIUS, 0, Math.PI * 2);
    ctx.clip();

    this.drawBackground(ctx, gameState.theme);
    this.drawFoods(ctx, gameState.foods, camera);
    this.drawCorpses(ctx, gameState.corpses, camera);
    if (gameState.particles?.length) {
      this.drawParticles(ctx, gameState.particles, camera);
    }
    this.drawFrogs(gameState.frogs, gameState.myId, gameState, camera);
    const player = gameState.frogs.find((f) => f.id === gameState.myId);
    if (
      player &&
      this.isInViewport(
        player.x,
        player.y,
        player.radius + JUMP_HEIGHT + 6,
        camera,
      )
    ) {
      this.drawPlayerFrog(ctx, player, gameState);
    }

    ctx.restore();

    ctx.beginPath();
    ctx.arc(MAP_CENTER, MAP_CENTER, MAP_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = '#52B788';
    const camScale = camera.scale || 1;
    ctx.lineWidth = MAP_BORDER_WIDTH / camScale;
    ctx.shadowBlur = MAP_BORDER_SHADOW_BLUR;
    ctx.shadowColor = '#52B788';
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (gameState.debugMode) {
      this.drawDebugMapCorners(ctx, camera);
    }

    camera.restore(ctx);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ bgStart: string; bgEnd: string; grid: string }} theme
   */
  drawBackground(ctx, theme) {
    const themeKey = `${theme.bgStart}|${theme.bgEnd}|${theme.grid}`;
    const bgc = this._bgCtx;
    if (!bgc) return;

    if (this._bgDirty || themeKey !== this._cachedBgThemeKey) {
      bgc.setTransform(1, 0, 0, 1, 0, 0);
      const g = bgc.createRadialGradient(
        MAP_CENTER,
        MAP_CENTER,
        0,
        MAP_CENTER,
        MAP_CENTER,
        MAP_RADIUS,
      );
      g.addColorStop(0, theme.bgStart);
      g.addColorStop(1, theme.bgEnd);
      bgc.fillStyle = g;
      bgc.beginPath();
      bgc.arc(MAP_CENTER, MAP_CENTER, MAP_RADIUS, 0, Math.PI * 2);
      bgc.fill();

      bgc.save();
      bgc.strokeStyle = theme.grid;
      bgc.globalAlpha = GRID_OPACITY;
      bgc.lineWidth = 1;
      for (let gx = 0; gx <= MAP_SIZE; gx += GRID_CELL_SIZE) {
        bgc.beginPath();
        bgc.moveTo(gx, 0);
        bgc.lineTo(gx, MAP_SIZE);
        bgc.stroke();
      }
      for (let gy = 0; gy <= MAP_SIZE; gy += GRID_CELL_SIZE) {
        bgc.beginPath();
        bgc.moveTo(0, gy);
        bgc.lineTo(MAP_SIZE, gy);
        bgc.stroke();
      }
      bgc.restore();

      this._bgDirty = false;
      this._cachedBgThemeKey = themeKey;
    }

    ctx.drawImage(/** @type {CanvasImageSource} */ (this._bgCanvas), 0, 0);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  _approxScaleFromCtx(ctx) {
    const t = ctx.getTransform();
    return Math.sqrt(t.a * t.a + t.b * t.b) || 1;
  }

  /**
   * Ölü kurbağa — yatar, döndürülmez; yarı saydam sprite.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<{ x: number; y: number; radius: number }> | undefined} corpses
   * @param {import('./Camera.js').Camera} camera
   */
  drawCorpses(ctx, corpses, camera) {
    if (!corpses?.length) return;
    const img = this._deadFrogImage;
    const ready = img.complete && img.naturalWidth > 0;

    for (const corpse of corpses) {
      const r = corpse.radius;
      if (!this.isInViewport(corpse.x, corpse.y, r + FOOD_GLOW_BLUR, camera)) {
        continue;
      }
      ctx.save();
      ctx.globalAlpha = CORPSE_OPACITY;
      ctx.translate(corpse.x, corpse.y);
      if (ready) {
        ctx.drawImage(img, -r, -r, r * 2, r * 2);
      } else {
        ctx.fillStyle = 'rgba(100,116,139,0.85)';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Harita dört köşesinde dünya koordinatı (debug).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./Camera.js').Camera} camera
   */
  drawDebugMapCorners(ctx, camera) {
    const fs = Math.max(14, 52 / Math.max(camera.scale, 0.05));
    const pad = fs * 0.35;
    ctx.font = `${fs}px ui-monospace, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = Math.max(1, 2 / (camera.scale || 1));

    const northY = MAP_CENTER - MAP_RADIUS + pad;
    const southY = MAP_CENTER + MAP_RADIUS - pad;
    const westX = MAP_CENTER - MAP_RADIUS + pad;
    const eastX = MAP_CENTER + MAP_RADIUS - pad;

    const corners = [
      {
        x: MAP_CENTER,
        y: northY,
        text: `N merkez (${MAP_CENTER},${MAP_CENTER}) R=${MAP_RADIUS}`,
        align: 'center',
        baseline: 'top',
      },
      { x: westX, y: MAP_CENTER, text: 'B', align: 'left', baseline: 'middle' },
      { x: eastX, y: MAP_CENTER, text: 'D', align: 'right', baseline: 'middle' },
      { x: MAP_CENTER, y: southY, text: 'G', align: 'center', baseline: 'bottom' },
    ];
    for (const c of corners) {
      ctx.textAlign = /** @type {CanvasTextAlign} */ (c.align);
      ctx.textBaseline = /** @type {CanvasTextBaseline} */ (c.baseline);
      ctx.strokeText(c.text, c.x, c.y);
      ctx.fillText(c.text, c.x, c.y);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<{ x: number; y: number; radius?: number; color?: string }>} foods
   * @param {import('./Camera.js').Camera} camera
   */
  drawFoods(ctx, foods, camera) {
    const r = FOOD_RADIUS;
    for (const f of foods) {
      const rad = f.radius ?? r;
      if (!this.isInViewport(f.x, f.y, rad + FOOD_GLOW_BLUR, camera)) {
        continue;
      }
      const col = f.color ?? '#52B788';
      ctx.save();
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = FOOD_GLOW_BLUR;
      ctx.beginPath();
      ctx.arc(f.x, f.y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./Particle.js').Particle[]} particles
   * @param {import('./Camera.js').Camera} camera
   */
  drawParticles(ctx, particles, camera) {
    for (const p of particles) {
      if (!this.isInViewport(p.x, p.y, 8, camera)) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * @param {Array<{ id: string | number; x: number; y: number; radius: number; angle: number; score?: number; color?: string; name?: string }>} frogs
   * @param {string | number} myId
   * @param {{ multiplayer?: boolean }} gameState
   * @param {import('./Camera.js').Camera} camera
   */
  drawFrogs(frogs, myId, gameState, camera) {
    const others = frogs.filter((f) => f.id !== myId);
    const sortKey = [...others]
      .map(
        (f) =>
          `${String(f.id)}:${Number(f.score ?? 0)}:${Number(f.radius)}`,
      )
      .sort()
      .join('|');
    if (sortKey !== this._frogSortKey) {
      this._frogSortKey = sortKey;
      this._frogDrawOrderIds = [...others]
        .sort((a, b) => {
          const dr = a.radius - b.radius;
          if (dr !== 0) return dr;
          return String(a.id).localeCompare(String(b.id));
        })
        .map((f) => f.id);
    }

    const byId = new Map(others.map((f) => [f.id, f]));
    /** @type {Array<{ id: string | number; x: number; y: number; radius: number; angle: number; score?: number; color?: string; name?: string }>} */
    const ordered = [];
    for (const id of this._frogDrawOrderIds) {
      const f = byId.get(id);
      if (f) ordered.push(f);
    }

    const mp = gameState.multiplayer === true;
    const pad = JUMP_HEIGHT + 6;
    for (const frog of ordered) {
      if (!this.isInViewport(frog.x, frog.y, frog.radius + pad, camera)) {
        continue;
      }
      if (mp && frog.color) {
        this._drawOtherFrogMultiplayer(this.ctx, frog);
        this._drawNickname(this.ctx, frog, '#ffffff');
      } else {
        this._drawFrogSprite(this.ctx, frog);
      }
    }
  }

  /**
   * Zıplama transformu (squash & stretch + görsel dikey ofset) — sadece çizim.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number; y: number; radius: number; angle: number }} frog
   */
  _beginFrogJumpDraw(ctx, frog) {
    const t = Date.now();
    const jumpPhase = (t % JUMP_PERIOD) / JUMP_PERIOD;
    const jumpScale = 1 + Math.sin(jumpPhase * Math.PI * 2) * JUMP_AMPLITUDE;
    const jumpOffset = -Math.abs(Math.sin(jumpPhase * Math.PI)) * JUMP_HEIGHT;

    ctx.save();
    ctx.translate(frog.x, frog.y + jumpOffset);
    ctx.rotate(frog.angle);
    ctx.scale(jumpScale, 1 / jumpScale);
  }

  /**
   * Sprite veya daire — hız / pozisyon mantığı yok, sadece görsel.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number; y: number; radius: number; angle: number; color?: string }} frog
   * @param {HTMLImageElement | null} spriteImg
   */
  drawFrog(ctx, frog, spriteImg) {
    const r = frog.radius;
    this._beginFrogJumpDraw(ctx, frog);

    if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
      ctx.drawImage(spriteImg, -r, -r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = frog.color || '#4ade80';
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Çok oyunculu: sunucu rengi + gözler (sprite yok).
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number; y: number; radius: number; angle: number; color?: string }} frog
   */
  _drawOtherFrogMultiplayer(ctx, frog) {
    const r = frog.radius;
    const fill = frog.color ?? '#94a3b8';

    this._beginFrogJumpDraw(ctx, frog);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    const eyeR = Math.max(2, r * 0.12);
    ctx.fillStyle = '#ffffff';
    for (const ox of [-r * 0.35, r * 0.35]) {
      ctx.beginPath();
      ctx.arc(ox, -r * 0.42, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number; y: number; radius: number; name?: string; id?: string | number }} frog
   * @param {string} color
   */
  _drawNickname(ctx, frog, color) {
    const r = frog.radius;
    const fs = Math.max(11, r * 0.38);
    const label = String(frog.name ?? frog.id ?? '');
    if (!label) return;
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = Math.max(1, 3 / (this._approxScaleFromCtx(ctx) || 1));
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.fillStyle = color;
    const y = frog.y - r - fs * 0.15;
    ctx.strokeText(label, frog.x, y);
    ctx.fillText(label, frog.x, y);
  }

  /**
   * Oyuncu: sprite + zıplama; MP’de yeşil nickname.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number; y: number; radius: number; angle: number; score?: number; name?: string; id?: string | number }} frog
   * @param {{ multiplayer?: boolean }} gameState
   */
  drawPlayerFrog(ctx, frog, gameState) {
    const img = this._frogImage;
    const hasSprite = img.complete && img.naturalWidth > 0;
    if (hasSprite) {
      this.drawFrog(ctx, frog, img);
    } else if (!gameState.multiplayer) {
      this._beginFrogJumpDraw(ctx, frog);
      this._drawFrogFallbackBody(ctx, frog.radius);
      ctx.restore();
    } else {
      this.drawFrog(ctx, frog, img);
    }

    if (gameState.multiplayer) {
      this._drawNickname(ctx, frog, '#86efac');
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} r
   */
  _drawFrogFallbackBody(ctx, r) {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    const eyeR = Math.max(2, r * 0.12);
    ctx.fillStyle = '#ffffff';
    for (const ox of [-r * 0.35, r * 0.35]) {
      ctx.beginPath();
      ctx.arc(ox, -r * 0.42, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number; y: number; radius: number; angle: number; score?: number }} frog
   */
  _drawFrogSprite(ctx, frog) {
    this.drawFrog(ctx, frog, this._frogImage);
  }
}
