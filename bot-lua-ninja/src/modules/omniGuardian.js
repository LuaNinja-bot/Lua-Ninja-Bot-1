'use strict';

const os = require('os');
const config = require('../config');
const { stmt, recordRequest, isUserBanned } = require('../database/db');
const { detectMaliciousContent } = require('./fileOutput');

let ownerDMCallback = null;
let clientRef = null;
let quarantineMode = false;
let lockdownMode = false;
let raidMode = false;
const raidWindowStart = { time: null, count: 0 };

function init(client, dmCallback) {
  clientRef = client;
  ownerDMCallback = dmCallback;
}

async function alertOwner(message) {
  if (ownerDMCallback) {
    try {
      await ownerDMCallback(message);
    } catch (e) {
      console.error('[GUARDIAN] Error al notificar Owner:', e.message);
    }
  }
}

function isInQuarantine() { return quarantineMode; }
function isInLockdown() { return lockdownMode; }
function isRaidModeActive() { return raidMode; }

function activateQuarantine() {
  quarantineMode = true;
  console.warn('[GUARDIAN] ⚠️ MODO CUARENTENA ACTIVADO');
  alertOwner('🔴 **GUARDIAN:** Modo Cuarentena activado. El bot responde con errores simulados.');
}

function deactivateQuarantine() {
  quarantineMode = false;
  console.log('[GUARDIAN] ✅ Modo Cuarentena desactivado.');
}

function activateLockdown() {
  lockdownMode = true;
  console.warn('[GUARDIAN] 🔒 MODO LOCKDOWN ACTIVADO');
}

function deactivateLockdown() {
  lockdownMode = false;
}

function getSystemMetrics() {
  const mem = process.memoryUsage();
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const ramPercent = ((usedMem / totalMem) * 100).toFixed(1);

  if (parseFloat(ramPercent) > 85) {
    alertOwner(`🔴 **GUARDIAN ALERTA:** RAM crítica al ${ramPercent}% (${Math.round(usedMem / 1024 / 1024)}MB / ${Math.round(totalMem / 1024 / 1024)}MB)`);
  }

  return {
    cpu: cpus.length + ' cores',
    ramUsedMB: Math.round(mem.rss / 1024 / 1024),
    ramTotalMB: Math.round(totalMem / 1024 / 1024),
    ramPercent,
    uptime: Math.round(process.uptime()),
    pid: process.pid,
    platform: os.platform(),
  };
}

async function getPipelineLatency() {
  const rows = stmt.getAvgLatency.all();
  const result = {};
  for (const row of rows) {
    result[row.agent_name] = Math.round(row.avg_ms);
  }
  return result;
}

async function getActiveThreadsInfo() {
  return stmt.getAllActiveThreads.all();
}

async function checkSpamAndBan(userId, member) {
  const windowMs = config.system.spamWindowMs;
  const count = recordRequest(userId, windowMs);
  if (count > config.system.spamThreshold) {
    const banUntil = new Date(Date.now() + config.system.banDurationHours * 3600000).toISOString();
    stmt.upsertBan.run(userId, banUntil);
    const username = member ? (member.user?.username || userId) : userId;
    alertOwner(
      `🚫 **GUARDIAN:** Usuario \`${username}\` (${userId}) bloqueado por spam.\n` +
      `Realizó ${count} peticiones en menos de 1 minuto. Ban hasta: ${new Date(banUntil).toLocaleString()}`
    );
    return true;
  }
  return false;
}

function checkRaid(newUsersCount) {
  const now = Date.now();
  if (!raidWindowStart.time || now - raidWindowStart.time > 60000) {
    raidWindowStart.time = now;
    raidWindowStart.count = newUsersCount;
  } else {
    raidWindowStart.count += newUsersCount;
  }

  if (raidWindowStart.count >= config.system.raidThreshold && !raidMode) {
    raidMode = true;
    alertOwner(
      `🚨 **GUARDIAN RAID ALERT:** Se detectó un posible Raid.\n` +
      `${raidWindowStart.count} usuarios nuevos usando comandos pesados en 60 segundos.\n` +
      `Modo Restringido activado: Solo usuarios verificados pueden usar la IA.`
    );
  }
  return raidMode;
}

function scanOutputForMalicious(content) {
  if (detectMaliciousContent(content)) {
    alertOwner(
      `🔴 **GUARDIAN CUARENTENA:** Output del Agente Ingeniero bloqueado.\n` +
      `Se detectaron patrones sospechosos de ejecución remota. El código NO fue entregado al usuario.`
    );
    return true;
  }
  if (Buffer.byteLength(content, 'utf8') > 500 * 1024) {
    alertOwner(`⚠️ **GUARDIAN:** Respuesta inusualmente grande (${Math.round(Buffer.byteLength(content, 'utf8') / 1024)}KB) puesta en cuarentena.`);
    return true;
  }
  return false;
}

async function generateGuardianReport() {
  const metrics = getSystemMetrics();
  const latencies = await getPipelineLatency();
  const threads = await getActiveThreadsInfo();
  const apiRows = stmt.getAvgLatency.all();

  return {
    metrics,
    pipeline: {
      Interfaz: latencies['Interfaz'] ? `${latencies['Interfaz']}ms` : 'Sin datos',
      Investigador: latencies['Investigador'] ? `${latencies['Investigador']}ms` : 'Sin datos',
      Ingeniero: latencies['Ingeniero'] ? `${latencies['Ingeniero']}ms` : 'Sin datos',
    },
    activeThreads: threads.length,
    threadsList: threads,
    modes: {
      quarantine: quarantineMode,
      lockdown: lockdownMode,
      raid: raidMode,
    },
  };
}

module.exports = {
  init,
  alertOwner,
  isInQuarantine,
  isInLockdown,
  isRaidModeActive,
  activateQuarantine,
  deactivateQuarantine,
  activateLockdown,
  deactivateLockdown,
  getSystemMetrics,
  getPipelineLatency,
  getActiveThreadsInfo,
  checkSpamAndBan,
  checkRaid,
  scanOutputForMalicious,
  generateGuardianReport,
};
