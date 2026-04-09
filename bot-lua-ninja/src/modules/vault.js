'use strict';

const { stmt } = require('../database/db');
const { isOwner } = require('./permissions');
const { buildDiscordAttachment, shouldUseFile } = require('./fileOutput');
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

function detectLanguage(code) {
  if (/game\.Players|workspace\.|script\.Parent|RunService|UserInputService/i.test(code)) return 'Lua/Roblox';
  if (/def |import |print\(|class |from |if __name__/i.test(code)) return 'Python';
  if (/function|const |let |var |require\(|module\.exports/i.test(code)) return 'JavaScript';
  if (/public static void|System\.out|class \w+ \{/i.test(code)) return 'Java';
  if (/#include|int main|std::/i.test(code)) return 'C++';
  if (/SELECT|INSERT|UPDATE|DELETE|FROM|WHERE/i.test(code)) return 'SQL';
  return 'Unknown';
}

function detectMainFunction(code, systemName) {
  const lower = (code + ' ' + systemName).toLowerCase();
  if (/anti.lag|optimize|performance/i.test(lower)) return 'Optimization';
  if (/ip.track|location|geoip/i.test(lower)) return 'IP-Tracker';
  if (/datastore|data.store|save.*data/i.test(lower)) return 'Data-Store';
  if (/movement|jump|dash|sprint/i.test(lower)) return 'Movement';
  if (/gui|interface|button|frame/i.test(lower)) return 'GUI';
  if (/combat|weapon|attack|damage/i.test(lower)) return 'Combat';
  if (/admin|ban|kick|mute/i.test(lower)) return 'Admin-System';
  if (/economy|coins|shop|purchase/i.test(lower)) return 'Economy';
  return 'General-Script';
}

function saveToVault(userId, systemName, codeContent, isPrivate = false) {
  const lang = detectLanguage(codeContent);
  const mainFunc = detectMainFunction(codeContent, systemName);
  const result = stmt.saveVault.run(userId, systemName, lang, mainFunc, codeContent, isPrivate ? 1 : 0);
  return { id: result.lastInsertRowid, lang, mainFunc };
}

async function buildVaultEmbed(entry, client) {
  const date = new Date(entry.created_at);
  let ownerName = entry.owner_id;
  try {
    const u = await client.users.fetch(entry.owner_id);
    ownerName = `${u.username} (${entry.owner_id})`;
  } catch {}

  return new EmbedBuilder()
    .setTitle('🗂️ NUEVO REGISTRO DE SISTEMA')
    .setColor(0x2B0045)
    .addFields(
      { name: 'Dueño', value: ownerName, inline: true },
      { name: 'Sistema', value: entry.system_name, inline: true },
      { name: 'Lenguaje', value: entry.language || 'Unknown', inline: true },
      { name: 'Función', value: entry.main_function || 'General', inline: true },
      { name: 'Fecha/Hora', value: `${date.toLocaleDateString('es')} - ${date.toLocaleTimeString('es')}`, inline: true },
    )
    .setFooter({ text: 'Bot Lua Ninja - Baúl de Sombras' })
    .setTimestamp();
}

async function sendToVaultChannel(client, entry) {
  const vaultChannelId = config.ids.vaultChannel;
  try {
    const channel = await client.channels.fetch(vaultChannelId);
    if (!channel) return;

    const embed = await buildVaultEmbed(entry, client);
    const content = entry.code_content;

    if (shouldUseFile(content)) {
      const { attachment, filePath } = buildDiscordAttachment(content, entry.system_name);
      const fs = require('fs');
      await channel.send({ embeds: [embed], files: [attachment] });
      setTimeout(() => { try { fs.unlinkSync(filePath); } catch {} }, 30000);
    } else {
      await channel.send({ embeds: [embed], content: `\`\`\`\n${content}\n\`\`\`` });
    }
  } catch (e) {
    console.error('[VAULT] Error enviando al canal Baúl:', e.message);
  }
}

function findInVault(userId, keyword, isOwnerUser) {
  const kw = `%${keyword}%`;
  if (isOwnerUser) {
    return stmt.findVaultOwnerOnly.all(kw);
  }
  return stmt.findVaultByKeyword.all(userId, kw, kw, kw);
}

function findByExactName(systemName, userId, isOwnerUser) {
  const kw = `%${systemName}%`;
  if (isOwnerUser) {
    return stmt.findVaultOwnerOnly.all(kw);
  }
  return stmt.findVaultByName.all(userId, kw);
}

function listAllForOwner() {
  return stmt.findVaultAllOwner.all();
}

function getVaultEntry(id) {
  return stmt.getVaultById.get(id);
}

const VAULT_HEADER = '--- RESULTADO DEL BAÚL DE SOMBRAS ---\n\n';

module.exports = {
  saveToVault,
  sendToVaultChannel,
  findInVault,
  findByExactName,
  listAllForOwner,
  getVaultEntry,
  VAULT_HEADER,
};
