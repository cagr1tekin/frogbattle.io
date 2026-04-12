/** @see .cursorrules Bölüm 7 — Oyun Mekaniği Sabitleri (server + client paylaşımı) */

/** Eski kare referansı / dünya üst sınırı (0…MAP_SIZE koordinat alanı) */
export const MAP_SIZE = 4000;
/** Oynanabilir alan: merkez ve yarıçap (dairesel harita) */
export const MAP_CENTER = 2000;
export const MAP_RADIUS = 2000;
export const BASE_SPEED = 180;
export const SPEED_SCALE = 0.001;
export const BASE_RADIUS = 28;
export const MAX_RADIUS = 140;
export const RADIUS_GROWTH = 0.25;
export const EAT_RATIO = 1.1;
export const SNEAK_ANGLE_THRESHOLD = 0.26;
export const FOOD_VALUE = 1;
export const KILL_RATIO = 0.5;
export const FOOD_COUNT = 400;
export const FOOD_RADIUS = 6;
/** Yem çizimi — gölge ile glow */
export const FOOD_GLOW_BLUR = 8;
export const JUMP_PERIOD = 400;
export const JUMP_AMPLITUDE = 0.12;
/** Görsel zıplama ofseti (dünya px) — hızı etkilemez */
export const JUMP_HEIGHT = 10;
export const BORDER_DAMAGE = 2;
export const MAX_PLAYERS_PER_ROOM = 3;
export const TICK_RATE = 20;

/** Ölü kurbağa (corpse) — süre ve çizim */
export const CORPSE_LIFETIME = 30000;
export const CORPSE_OPACITY = 0.7;

/** Kamera — yumuşak takip ve zoom */
export const CAMERA_LERP_SPEED = 8;
export const CAMERA_ZOOM_SCORE_FACTOR = 0.0008;

/** Harita çizimi — grid ve sınır */
export const GRID_CELL_SIZE = 100;
export const GRID_OPACITY = 0.15;
export const MAP_BORDER_WIDTH = 6;
export const MAP_BORDER_SHADOW_BLUR = 20;

/** Oyun döngüsü — delta time üst sınırı (saniye) */
export const DELTA_TIME_CAP = 0.05;

/** Yem patlaması — parçacık */
export const FOOD_PARTICLE_MIN = 5;
export const FOOD_PARTICLE_MAX = 8;
export const FOOD_PARTICLE_LIFE_MS = 300;

/** Harita kenarı uyarısı — ekran overlay */
export const BORDER_WARN_DISTANCE = 200;
export const BORDER_WARN_MAX_OPACITY = 0.4;
