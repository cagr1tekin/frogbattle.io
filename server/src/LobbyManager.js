import { MAX_PLAYERS_PER_ROOM } from '../../shared/constants.js';

/** Faz 2 — lobide oyunu başlatmak için minimum oyuncu. */
export const MIN_PLAYERS_TO_START = 2;

/**
 * Tek varsayılan oda (Faz 3’te çoklu oda genişletilebilir).
 * Bağlanan oyuncu otomatik bu odaya eklenir.
 */
export class LobbyManager {
  /**
   * @param {import('./GameRoom.js').GameRoom} room
   */
  constructor(room) {
    /** @type {import('./GameRoom.js').GameRoom} */
    this.room = room;
  }

  /**
   * Oyuncuyu odaya alır; sayı yeterliyse oyun döngüsünü başlatır ve `game:start` yollar.
   * @param {import('@geckos.io/server').ServerChannel} channel
   * @param {string} displayName
   */
  addPlayer(channel, displayName) {
    if (this.room.players.size >= MAX_PLAYERS_PER_ROOM) {
      channel.emit('lobby:full', { max: MAX_PLAYERS_PER_ROOM }, { reliable: true });
      return;
    }
    this.room.addPlayer(channel, displayName);
    this.broadcastLobbyState();
    // İstemci tarafında bridge aboneliği çok geç açılırsa ilk lobby:state kaçabiliyor — gecikmeli yedek.
    const id = channel.id;
    const resync = () => {
      if (this.room.players.has(id)) this.sendLobbyStateTo(channel);
    };
    setTimeout(resync, 80);
    setTimeout(resync, 400);
    if (this.room.players.size >= MIN_PLAYERS_TO_START && !this.room.isRunning) {
      this.room.resetMatchState();
      this.room.startLoop();
      for (const { channel: ch } of this.room.players.values()) {
        ch.emit('game:start', { minPlayers: MIN_PLAYERS_TO_START }, { reliable: true });
      }
    }
  }

  /**
   * Kurbağayı odadan çıkarır; 2’den az oyuncu kalırsa döngü durur.
   * @param {string | number} channelId
   */
  removePlayer(channelId) {
    this.room.removePlayer(channelId);
    this.broadcastLobbyState();
  }

  /** Bağlı tüm istemcilere anlık oyuncu sayısı. */
  broadcastLobbyState() {
    const count = this.room.players.size;
    const max = MAX_PLAYERS_PER_ROOM;
    const payload = { count, max };
    for (const { channel } of this.room.players.values()) {
      channel.emit('lobby:state', payload, { reliable: true });
    }
  }

  /**
   * Tek kanala güncel sayı — WebRTC tarafında `channel.on` hazır olduktan sonra (ilk yayın kaçmasın).
   * @param {import('@geckos.io/server').ServerChannel} channel
   */
  sendLobbyStateTo(channel) {
    const count = this.room.players.size;
    const max = MAX_PLAYERS_PER_ROOM;
    channel.emit('lobby:state', { count, max }, { reliable: true });
  }
}
