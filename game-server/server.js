const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg');
const { createClient } = require('redis');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Подключение к PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://user:password@postgres:5432/gamedb'
});

// Подключение к Redis
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
redisClient.on('error', (err) => console.log('Redis Error', err));
redisClient.connect();

app.get('/health', (req, res) => res.status(200).send('OK'));

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    socket.on('find_match', async (playerName) => {
        // Сохраняем игрока в очередь Redis
        await redisClient.rPush('matchmaking_queue', JSON.stringify({ id: socket.id, name: playerName }));
        
        const queueLength = await redisClient.lLen('matchmaking_queue');
        if (queueLength >= 2) {
            const p1 = JSON.parse(await redisClient.lPop('matchmaking_queue'));
            const p2 = JSON.parse(await redisClient.lPop('matchmaking_queue'));
            
            const roomId = `room_${p1.id}_${p2.id}`;
            socket.join(roomId);
            io.sockets.sockets.get(p1.id)?.join(roomId);

            io.to(roomId).emit('match_found', { room: roomId, p1: p1.name, p2: p2.name });
        }
    });

    socket.on('make_move', ({ roomId, board, winner, turn }) => {
        socket.to(roomId).emit('opponent_moved', { board, winner, turn });
        
        // Если игра окончена, записываем в БД
        if (winner) {
            saveGameResult(winner, roomId);
        }
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
    });
});

async function saveGameResult(winnerName, roomId) {
    try {
        // В реальном проекте здесь нужно определять проигравшего
        // Для упрощения просто обновляем статистику победителя
        await pool.query(
            "INSERT INTO players (name, wins) VALUES ($1, 1) ON CONFLICT (name) DO UPDATE SET wins = players.wins + 1",
            [winnerName]
        );
        console.log(`Результат сохранен для ${winnerName} в БД`);
    } catch (err) {
        console.error('Ошибка БД:', err);
    }
}

const PORT = 3000;
server.listen(PORT, () => console.log(`Game Server running on port ${PORT}`));