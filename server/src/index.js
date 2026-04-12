import http from 'node:http';
import geckos from '@geckos.io/server';
import { GameRoom } from './GameRoom.js';
import { LobbyManager } from './LobbyManager.js';

const PORT = Number(process.env.PORT) || 9208;

const room = new GameRoom();
const lobby = new LobbyManager(room);

const io = geckos();

const httpServer = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('FrogBattle.io Geckos');
});

io.addServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
});

/**
 * Geckos: yeni kanal = bağlantı (channel.on('connection') yerine io.onConnection).
 */
io.onConnection((channel) => {
  const channelId = channel.id;
  console.log(`Oyuncu bağlandı: ${channelId}`);

  const displayName = `Oyuncu_${String(channelId).slice(0, 8)}`;

  channel.on('input', (data) => {
    if (data && typeof data === 'object' && 'angle' in data) {
      room.onInput(channelId, /** @type {{ angle: number }} */ (data));
    }
  });

  channel.onDisconnect(() => {
    lobby.removePlayer(channelId);
    console.log(`Oyuncu ayrıldı: ${channelId}`);
  });

  lobby.addPlayer(channel, displayName);
});
