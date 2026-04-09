'use strict';

const { isOwner, getUserPermission, PERM } = require('../modules/permissions');
const {
  saveToVault,
  sendToVaultChannel,
  findInVault,
  findByExactName,
  listAllForOwner,
  getVaultEntry,
  VAULT_HEADER,
} = require('../modules/vault');
const { getThreadContext } = require('../modules/threadManager');
const { sendCodeResponse, buildDiscordAttachment, shouldUseFile } = require('../modules/fileOutput');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');

async function getLastCodeFromThread(userId, channel) {
  if (channel.isThread()) {
    const history = getThreadContext(channel.id);
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    return lastAssistant ? lastAssistant.content : null;
  }
  return null;
}

async function handleSave(message, args, client) {
  const userId = message.author.id;
  const member = message.member || {};
  const perm = getUserPermission(member, userId);
  const ownerUser = isOwner(userId);

  if (perm === PERM.DENIED || perm === PERM.BANNED) {
    return;
  }

  const rawName = args.join(' ').trim();
  const isPrivate = rawName.endsWith('--private');
  const systemName = rawName.replace('--private', '').trim() || `system_${Date.now()}`;

  const lastCode = await getLastCodeFromThread(userId, message.channel);
  if (!lastCode) {
    return message.reply(
      '⚠️ No se encontró código reciente en esta sesión para guardar.\n' +
      'Genera código primero con `#code` y luego usa `#save <nombre>`.'
    );
  }

  const savedEntry = saveToVault(userId, systemName, lastCode, isPrivate || !ownerUser);

  await sendToVaultChannel(client, {
    owner_id: userId,
    system_name: systemName,
    language: savedEntry.lang,
    main_function: savedEntry.mainFunc,
    code_content: lastCode,
    created_at: new Date().toISOString(),
    is_private: isPrivate ? 1 : 0,
  });

  const confirmMsg = ownerUser
    ? `✅ Código guardado en el Baúl de Sombras como \`${systemName}\`.\n🔖 Lenguaje: \`${savedEntry.lang}\` | Función: \`${savedEntry.mainFunc}\``
    : `✅ Tu código fue guardado de forma privada como \`${systemName}\`.`;

  return message.reply(confirmMsg);
}

async function handleFind(message, args, isExact = false) {
  const userId = message.author.id;
  const member = message.member || {};
  const perm = getUserPermission(member, userId);
  const ownerUser = isOwner(userId);

  if (perm === PERM.DENIED || perm === PERM.BANNED) {
    return message.reply('❌ Acceso denegado.');
  }

  const keyword = args.join(' ').trim();

  if (!keyword) {
    if (ownerUser) {
      const allEntries = listAllForOwner();
      if (!allEntries.length) return message.reply('📭 El Baúl está vacío.');

      const list = allEntries.map((e, i) =>
        `${i + 1}. \`${e.system_name}\` [${e.language}] — ${e.main_function} — <@${e.owner_id}> (${new Date(e.created_at).toLocaleDateString('es')})`
      ).join('\n');

      const content = `${VAULT_HEADER}ÍNDICE COMPLETO DEL BAÚL DE SOMBRAS\n\n${list}`;
      return sendCodeResponse(message.channel, content, 'vault_index', {
        header: `🗂️ **Baúl de Sombras — ${allEntries.length} sistema(s) registrado(s)**`,
      });
    }
    return message.reply('⚠️ Proporciona una palabra clave. Ejemplo: `#find anti lag`');
  }

  let results;
  if (isExact) {
    results = findByExactName(keyword, userId, ownerUser);
  } else {
    results = findInVault(userId, keyword, ownerUser);
  }

  if (!results || results.length === 0) {
    if (!ownerUser) {
      return message.reply('❌ **Acceso denegado:** No tienes permisos para este registro.');
    }
    return message.reply(`📭 No se encontraron sistemas con \`${keyword}\` en el Baúl.`);
  }

  if (results.length === 1) {
    const entry = results[0];
    const content = `${VAULT_HEADER}Sistema: ${entry.system_name}\nLenguaje: ${entry.language}\nFunción: ${entry.main_function}\nFecha: ${entry.created_at}\n\n${entry.code_content}`;

    return sendCodeResponse(message.channel, content, `vault_${entry.system_name}`, {
      header: `✅ **Código recuperado del Baúl:** \`${entry.system_name}\``,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🗂️ ${results.length} Sistema(s) encontrado(s) en el Baúl`)
    .setColor(0x2B0045)
    .setDescription(
      results.map((e, i) =>
        `\`${i + 1}.\` **${e.system_name}** — [${e.language}] ${e.main_function}`
      ).join('\n') +
      `\n\nUsa \`#find/ <nombre exacto>\` para recuperar un sistema específico.`
    )
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

module.exports = { handleSave, handleFind };
