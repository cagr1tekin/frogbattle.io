import geckos from '@geckos.io/client';

/**
 * Geckos.io WebRTC kanalı — bağlantı ve olay çoklayıcı.
 */
export class GeckosClient {
  /**
   * @param {{ url?: string; port?: number }} [options]
   */
  constructor(options = {}) {
    this._url = options.url ?? 'http://localhost';
    this._port = options.port ?? 9208;
    /** @type {ReturnType<typeof geckos> | null} */
    this._channel = null;
    this._connected = false;
    /** @type {Map<string, Set<(data: unknown) => void>>} */
    this._handlers = new Map();
    /** @type {Set<string>} */
    this._boundServerEvents = new Set();
  }

  get isConnected() {
    return this._connected;
  }

  /** Bağlı kanal kimliği (onConnect sonrası). */
  get channelId() {
    return this._channel?.id ?? null;
  }

  /**
   * @param {string} eventName
   * @param {unknown} [data]
   * @param {{ reliable?: boolean }} [options]
   */
  emit(eventName, data, options) {
    if (this._channel) {
      this._channel.emit(eventName, data, options);
    }
  }

  /**
   * Oyuncu girdisi — sunucu `targetAngle` + dil zorla çıkarma (unreliable, her kare).
   * @param {number} angle hedef açı (radyan) — fare yönü; sunucu skora bağlı döner.
   * @param {boolean} [tongueForce]
   */
  sendInput(angle, tongueForce = false) {
    this.emit(
      'input',
      { angle, tongueForce: !!tongueForce },
      { reliable: false },
    );
  }

  /**
   * @returns {Promise<void>}
   */
  connect() {
    if (this._connected) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this._channel = geckos({
        url: this._url,
        port: this._port,
      });

      this._channel.onConnect((err) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        this._connected = true;
        this._bindAllEvents();
        resolve();
      });

      this._channel.onDisconnect(() => {
        this._connected = false;
      });
    });
  }

  disconnect() {
    if (this._channel) {
      this._channel.close();
      this._channel = null;
    }
    this._connected = false;
    this._boundServerEvents.clear();
  }

  /**
   * Sunucudan gelen olaylar (geckos channel.on).
   * @param {string} event
   * @param {(data: unknown) => void} handler
   */
  on(event, handler) {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);

    if (this._channel && this._connected && !this._boundServerEvents.has(event)) {
      this._subscribeEvent(event);
    }
  }

  /**
   * Kayıtlı tüm olayları kanala bağla (connect sonrası).
   */
  _bindAllEvents() {
    if (!this._channel) return;
    for (const event of this._handlers.keys()) {
      if (!this._boundServerEvents.has(event)) {
        this._subscribeEvent(event);
      }
    }
  }

  /**
   * @param {string} event
   */
  _subscribeEvent(event) {
    if (!this._channel || this._boundServerEvents.has(event)) return;
    this._boundServerEvents.add(event);
    this._channel.on(event, (data) => {
      const set = this._handlers.get(event);
      if (!set) return;
      for (const h of set) {
        h(data);
      }
    });
  }
}
