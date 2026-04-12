import {
  BORDER_WARN_DISTANCE,
  BORDER_WARN_MAX_OPACITY,
  MAP_CENTER,
  MAP_RADIUS,
  MAX_PLAYERS_PER_ROOM,
} from './constants.js';
import { debugFlags } from './debugFlags.js';
import { Camera } from './game/Camera.js';
import { GameLoop } from './game/GameLoop.js';
import { InputHandler } from './game/InputHandler.js';
import { Interpolation } from './game/Interpolation.js';
import { LocalGame } from './game/LocalGame.js';
import { Renderer } from './game/Renderer.js';
import { GeckosClient } from './network/GeckosClient.js';

/** `false` → Faz 1 yerel oyun; `true` → Geckos.io çok oyunculu */
const MULTIPLAYER = true;

const ORMAN_THEME = {
  bgStart: '#1a3a1a',
  bgEnd: '#2D5A27',
  grid: '#52B788',
};

const canvas = document.getElementById('gameCanvas');
if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#gameCanvas bulunamadı');
}

const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('2D context alınamadı');
}

const mpGameRoot = document.getElementById('mp-game-root');
const lobbyOverlay = document.getElementById('lobby-overlay');
const lobbyStatusEl = document.getElementById('lobby-status');
const lobbyCountEl = document.getElementById('lobby-count');
const hudScore = document.getElementById('hud-score');
const hudFps = document.getElementById('hud-fps');
const dangerTop = document.getElementById('danger-top');
const dangerBottom = document.getElementById('danger-bottom');
const dangerLeft = document.getElementById('danger-left');
const dangerRight = document.getElementById('danger-right');

if (
  !mpGameRoot ||
  !lobbyOverlay ||
  !lobbyStatusEl ||
  !lobbyCountEl ||
  !hudScore ||
  !hudFps ||
  !dangerTop ||
  !dangerBottom ||
  !dangerLeft ||
  !dangerRight
) {
  throw new Error('HUD / lobby öğeleri eksik');
}

/** Çok oyunculu: `game:start` gelene kadar oyun sahnesi kapalı */
let mpGameStarted = false;

if (!MULTIPLAYER) {
  lobbyOverlay.classList.add('is-hidden');
} else {
  mpGameRoot.classList.add('mp-game-root--hidden');
  lobbyStatusEl.textContent = 'Arkadaşını bekliyoruz...';
  lobbyCountEl.textContent = `0/${MAX_PLAYERS_PER_ROOM} oyuncu`;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const localGame = new LocalGame(canvas);
const camera = new Camera(canvas);
const renderer = new Renderer(ctx, canvas);

const interpolation = new Interpolation();
const mpInput = new InputHandler(canvas);
/** @type {GeckosClient | null} */
let geckosClient = null;
/** @type {string | number | null} */
let multiplayerMyId = null;

/**
 * Sınırdan uzaklığa göre kenar overlay opaklığı (0–BORDER_WARN_MAX_OPACITY).
 * @param {import('./game/FrogEntity.js').FrogEntity | { x: number; y: number; isAlive?: boolean } | null | undefined} player
 */
function updateDangerOverlay(player) {
  const edges = [dangerTop, dangerBottom, dangerLeft, dangerRight];
  if (!player || player.isAlive === false) {
    for (const el of edges) {
      el.style.opacity = '0';
    }
    return;
  }
  const W = BORDER_WARN_DISTANCE;
  const maxO = BORDER_WARN_MAX_OPACITY;
  const { x, y } = player;
  const distC = Math.hypot(x - MAP_CENTER, y - MAP_CENTER);
  const dEdge = MAP_RADIUS - distC;
  const dTop = dEdge;
  const dBottom = dEdge;
  const dLeft = dEdge;
  const dRight = dEdge;

  function opacityForDist(d) {
    if (d >= W) return 0;
    return ((W - d) / W) * maxO;
  }

  dangerTop.style.opacity = String(opacityForDist(dTop));
  dangerBottom.style.opacity = String(opacityForDist(dBottom));
  dangerLeft.style.opacity = String(opacityForDist(dLeft));
  dangerRight.style.opacity = String(opacityForDist(dRight));
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'd') {
    debugFlags.showDebugOverlay = !debugFlags.showDebugOverlay;
    e.preventDefault();
  }
  if (!MULTIPLAYER && k === 'r') {
    localGame.respawnPlayer();
    camera.snapTo(localGame.playerFrog);
    e.preventDefault();
  }
});

function update(dt) {
  if (MULTIPLAYER) {
    if (geckosClient?.isConnected && mpGameStarted) {
      geckosClient.emit('input', { angle: mpInput.getAngle() }, { reliable: false });
    }
    if (!mpGameStarted) {
      return;
    }
    const { frogs } = interpolation.getInterpolated(performance.now());
    const me = multiplayerMyId != null ? frogs.find((f) => f.id === multiplayerMyId) : undefined;
    if (me) {
      camera.update(
        { x: me.x, y: me.y, score: Number(me.score ?? 0) },
        dt,
      );
    }
    return;
  }

  localGame.update(dt);
  const state = localGame.getState();
  const player = state.frogs.find((f) => f.id === state.myId);
  if (player) {
    camera.update(player, dt);
  }
}

function render() {
  if (MULTIPLAYER && !mpGameStarted) {
    return;
  }

  if (MULTIPLAYER) {
    const { frogs, foods, corpses } = interpolation.getInterpolated(
      performance.now(),
    );
    const me =
      multiplayerMyId != null
        ? frogs.find((f) => f.id === multiplayerMyId)
        : undefined;
    const playerFrog = me ?? {
      x: MAP_CENTER,
      y: MAP_CENTER,
      score: 0,
      isAlive: true,
    };

    hudScore.textContent = `Skor: ${Number(playerFrog.score ?? 0)}`;
    updateDangerOverlay(playerFrog);

    if (debugFlags.showDebugOverlay) {
      hudFps.classList.add('is-visible');
      hudFps.textContent = `FPS: ${gameLoop.fps} | Oyuncu: ${frogs.length} | Yem: ${foods.length} | Corpse: ${corpses.length}`;
    } else {
      hudFps.classList.remove('is-visible');
    }

    renderer.render(
      {
        theme: ORMAN_THEME,
        foods,
        frogs,
        myId: multiplayerMyId ?? '',
        multiplayer: true,
        particles: [],
        corpses,
        debugMode: debugFlags.showDebugOverlay,
        playerFrog,
      },
      camera,
    );
    return;
  }

  const state = localGame.getState();
  hudScore.textContent = `Skor: ${state.playerFrog.score}`;
  updateDangerOverlay(state.playerFrog);

  if (debugFlags.showDebugOverlay) {
    hudFps.classList.add('is-visible');
    const corpsesL = (state.corpses ?? []).length;
    hudFps.textContent = `FPS: ${gameLoop.fps} | Oyuncu: ${state.frogs.length} | Yem: ${state.foods.length} | Corpse: ${corpsesL}`;
  } else {
    hudFps.classList.remove('is-visible');
  }

  renderer.render(
    {
      ...state,
      corpses: state.corpses ?? [],
      multiplayer: false,
    },
    camera,
  );
}

const gameLoop = new GameLoop({ update, render });
gameLoop.start();

/**
 * Geckos — Vercel build'de VITE_GECKOS_URL şart.
 * Port boşsa: https → 443, aksi → 9208 (yerel http://localhost ile uyumlu).
 */
function getGeckosConnectionOptions() {
  const raw = import.meta.env.VITE_GECKOS_URL;
  const url =
    typeof raw === 'string' && raw.trim().length > 0
      ? raw.trim()
      : 'http://localhost';

  const portRaw = import.meta.env.VITE_GECKOS_PORT;
  const hasExplicitPort =
    portRaw !== undefined && portRaw !== null && String(portRaw).trim() !== '';

  let port = hasExplicitPort ? Number(portRaw) : NaN;
  if (!Number.isFinite(port) || port <= 0) {
    port = url.startsWith('https:') ? 443 : 9208;
  }

  return { url, port };
}

if (MULTIPLAYER) {
  const geckosOpts = getGeckosConnectionOptions();
  console.info('[Geckos] Hedef:', `${geckosOpts.url}:${geckosOpts.port}`);
  geckosClient = new GeckosClient(geckosOpts);
  geckosClient.on('lobby:state', (data) => {
    if (data && typeof data === 'object' && 'count' in data) {
      const max = typeof data.max === 'number' ? data.max : 2;
      const c = Number(data.count);
      lobbyCountEl.textContent = `${c}/${max} oyuncu`;
      if (mpGameStarted && c < max) {
        mpGameStarted = false;
        lobbyOverlay.classList.remove('is-hidden');
        mpGameRoot.classList.add('mp-game-root--hidden');
        lobbyStatusEl.textContent = 'Arkadaşını bekliyoruz...';
      }
    }
  });
  geckosClient.on('game:start', () => {
    mpGameStarted = true;
    lobbyOverlay.classList.add('is-hidden');
    mpGameRoot.classList.remove('mp-game-root--hidden');
  });
  geckosClient.on('state', (data) => {
    if (data && typeof data === 'object') {
      interpolation.update(data);
    }
  });
  geckosClient
    .connect()
    .then(() => {
      multiplayerMyId = geckosClient.channelId;
      console.log('Bağlandı');
    })
    .catch((err) => {
      console.warn('Geckos bağlantısı yok:', err?.message ?? err);
      const { url, port } = geckosOpts;
      const isLocal =
        url.includes('localhost') || url.includes('127.0.0.1');
      if (import.meta.env.PROD) {
        lobbyStatusEl.textContent = `Bağlanılamadı: ${url}:${port}`;
        lobbyCountEl.textContent =
          url.includes('localhost')
            ? 'Vercel → Environment Variables → VITE_GECKOS_URL=https://…onrender.com → Redeploy (build şart).'
            : 'Sunucu uyuyor olabilir (Render ücretsiz: ilk istek ~1 dk). Vercel’de env sonrası Redeploy yaptın mı?';
      } else if (isLocal) {
        lobbyStatusEl.textContent =
          'Sunucuya bağlanılamadı (sunucu çalışmıyor veya port kapalı).';
        lobbyCountEl.textContent =
          'Kökte: npm run server — sonra yenile. Adres: ' + url + ':' + port;
      } else {
        lobbyStatusEl.textContent = 'Sunucuya bağlanılamadı.';
        lobbyCountEl.textContent = `${url}:${port} — .env veya Vercel’de VITE_GECKOS_* kontrol et.`;
      }
    });
} else {
  console.log('Yerel mod (Faz 1)');
}

console.log('FrogBattle.io başlatıldı');
