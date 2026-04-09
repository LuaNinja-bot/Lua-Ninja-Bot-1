'use strict';

const { EmbedBuilder } = require('discord.js');
const { getAllAPIStatus } = require('../modules/apiClient');
const { isOwnerOrAdmin } = require('../modules/permissions');

async function handleBack(message) {
  const userId = message.author.id;
  const member = message.member || {};

  if (!isOwnerOrAdmin(member, userId)) {
    return message.reply('❌ Solo Owner/Admin pueden ver el estado de APIs de respaldo.');
  }

  const loadingMsg = await message.reply('🔍 Midiendo latencia de todas las APIs...');

  const statuses = await getAllAPIStatus();

  const embed = new EmbedBuilder()
    .setTitle('📡 Estado del Sistema de APIs - Bot Lua Ninja')
    .setColor(0x1A0040)
    .setDescription('Estado actual de todas las APIs registradas en el sistema de fallback.')
    .setTimestamp()
    .setFooter({ text: 'Bot Lua Ninja | OMNI-GUARDIAN' });

  for (const api of statuses) {
    const latencyDisplay = api.latency === -1
      ? '❌ Sin respuesta'
      : `\`${api.latency}ms\``;

    embed.addFields({
      name: `${api.status} ${api.name}`,
      value: `Latencia: ${latencyDisplay} | Rol: \`${getRoleLabel(api.key)}\``,
      inline: false,
    });
  }

  await loadingMsg.edit({ content: '', embeds: [embed] });
}

function getRoleLabel(key) {
  const labels = {
    primary: 'Principal (Llama 405B - Agente Ingeniero)',
    fallback: 'Respaldo 1 (GPT-4o)',
    fallback2: 'Respaldo 2 (Llama 70B - Groq)',
    interface: 'Interfaz (GPT-4o-mini)',
    research: 'Investigador (Perplexity Sonar)',
  };
  return labels[key] || key;
}

module.exports = { handleBack };
