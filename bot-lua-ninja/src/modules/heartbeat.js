'use strict';

const express = require('express');
const config = require('../config');

const app = express();
let server = null;
let heartbeatInterval = null;

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    bot: 'Bot Lua Ninja',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ alive: true, pid: process.pid });
});

function startHeartbeat() {
  server = app.listen(config.system.port, () => {
    console.log(`[HEARTBEAT] Servidor anti-sleep activo en puerto ${config.system.port}`);
  });

  heartbeatInterval = setInterval(() => {
    const used = process.memoryUsage();
    console.log(
      `[HEARTBEAT] Pulso interno OK | RAM: ${Math.round(used.rss / 1024 / 1024)}MB | ` +
      `Uptime: ${Math.round(process.uptime())}s`
    );
  }, config.system.heartbeatInterval);

  server.on('error', (err) => {
    console.error('[HEARTBEAT] Error en servidor:', err.message);
  });
}

function stopHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (server) server.close();
}

module.exports = { startHeartbeat, stopHeartbeat };
