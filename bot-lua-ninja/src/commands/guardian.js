'use strict';

const { EmbedBuilder } = require('discord.js');
const { isOwner } = require('../modules/permissions');
const {
  generateGuardianReport,
  isInQuarantine,
  isInLockdown,
  isRaidModeActive,
  activateQuarantine,
  deactivateQuarantine,
  activateLockdown,
  deactivateLockdown,
} = require('../modules/omniGuardian');
const { getAllAPIStatus } = require('../modules/apiClient');
const config = require('../config');

async function handleGuardian(message, args) {
  const userId = message.author.id;

  if (!isOwner(userId)) {
    return message.reply('❌ Acceso denegado. Solo el Owner puede ver el reporte GUARDIAN.');
  }

  const subCommand = args[0];

  if (subCommand === 'quarantine-on') {
    activateQuarantine();
    return message.reply('🔴 **MODO CUARENTENA** activado. El bot responde con errores simulados.');
  }

  if (subCommand === 'quarantine-off') {
    deactivateQuarantine();
    return message.reply('✅ **Modo Cuarentena** desactivado. Sistema restaurado.');
  }

  if (subCommand === 'lockdown-on') {
    activateLockdown();
    return message.reply('🔒 **LOCKDOWN** activado.');
  }

  if (subCommand === 'lockdown-off') {
    deactivateLockdown();
    return message.reply('✅ **Lockdown** desactivado.');
  }

  const loadMsg = await message.reply('🔍 Generando reporte OMNI-GUARDIAN...');

  const [report, apiStatuses] = await Promise.all([
    generateGuardianReport(),
    getAllAPIStatus(),
  ]);

  const { metrics, pipeline, activeThreads, threadsList, modes } = report;

  const mainEmbed = new EmbedBuilder()
    .setTitle('🛡️ OMNI-GUARDIAN — Reporte Completo del Sistema')
    .setColor(modes.quarantine ? 0xFF0000 : modes.lockdown ? 0xFF6600 : 0x2B0045)
    .setTimestamp()
    .setFooter({ text: 'Bot Lua Ninja | Security Intelligence Core' });

  mainEmbed.addFields(
    {
      name: '💻 Métricas del Sistema',
      value: [
        `CPU: \`${metrics.cpu}\``,
        `RAM Usada: \`${metrics.ramUsedMB}MB / ${metrics.ramTotalMB}MB\` (${metrics.ramPercent}%)`,
        `Uptime: \`${Math.floor(metrics.uptime / 3600)}h ${Math.floor((metrics.uptime % 3600) / 60)}m\``,
        `PID: \`${metrics.pid}\` | Plataforma: \`${metrics.platform}\``,
      ].join('\n'),
      inline: false,
    },
    {
      name: '⚡ Latencia del Pipeline (última hora)',
      value: [
        `Agente Interfaz: \`${pipeline.Interfaz}\``,
        `Agente Investigador: \`${pipeline.Investigador}\``,
        `Agente Ingeniero: \`${pipeline.Ingeniero}\``,
      ].join('\n'),
      inline: false,
    },
    {
      name: '🧵 Hilos Activos',
      value: activeThreads > 0
        ? `**${activeThreads} hilo(s) activo(s):**\n` +
          threadsList.map(t => `• <@${t.user_id}> → \`${t.thread_name}\``).join('\n')
        : '✅ Sin hilos activos actualmente.',
      inline: false,
    },
    {
      name: '🔐 Estado de Seguridad',
      value: [
        `Cuarentena: ${modes.quarantine ? '🔴 ACTIVA' : '✅ Inactiva'}`,
        `Lockdown: ${modes.lockdown ? '🔒 ACTIVO' : '✅ Inactivo'}`,
        `Modo Raid: ${modes.raid ? '🚨 ACTIVO' : '✅ Inactivo'}`,
      ].join('\n'),
      inline: false,
    }
  );

  const apiEmbed = new EmbedBuilder()
    .setTitle('📡 Estado de APIs de Respaldo')
    .setColor(0x1A0040)
    .setTimestamp();

  for (const api of apiStatuses) {
    apiEmbed.addFields({
      name: `${api.status} ${api.name}`,
      value: `Latencia: ${api.latency === -1 ? '❌' : `\`${api.latency}ms\``}`,
      inline: true,
    });
  }

  await loadMsg.edit({ content: '', embeds: [mainEmbed, apiEmbed] });
}

module.exports = { handleGuardian };
