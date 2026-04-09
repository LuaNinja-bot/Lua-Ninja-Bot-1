'use strict';

const { stmt, ensureUser } = require('../database/db');
const { isOwner } = require('../modules/permissions');
const { EmbedBuilder } = require('discord.js');

async function handleGiveBase(message, args) {
  const userId = message.author.id;
  if (!isOwner(userId)) return;

  const targetUser = message.mentions.users.first();
  const amount = parseInt(args[1]);

  if (!targetUser || isNaN(amount) || amount <= 0) {
    return message.reply('⚠️ Uso: `give @usuario <cantidad>`\nEjemplo: `give @ninja 5`');
  }

  ensureUser(targetUser.id);
  stmt.giveBaseTokens.run(amount, targetUser.id);

  const updated = stmt.getUser.get(targetUser.id);
  return message.reply(
    `✅ **+${amount} tokens base** regalados a <@${targetUser.id}>.\n` +
    `📊 Balance actual: Diarios \`${updated.base_tokens}\` | Ninja \`${updated.gift_bp}\``
  );
}

async function handleGiveBypass(message, args) {
  const userId = message.author.id;
  if (!isOwner(userId)) return;

  const targetUser = message.mentions.users.first();
  const amount = parseInt(args[1]);

  if (!targetUser || isNaN(amount) || amount <= 0) {
    return message.reply('⚠️ Uso: `#give/ @usuario <cantidad>`\nEjemplo: `#give/ @ninja 3`');
  }

  ensureUser(targetUser.id);
  stmt.giveBypassTokens.run(amount, targetUser.id);

  const updated = stmt.getUser.get(targetUser.id);
  return message.reply(
    `✅ **+${amount} tokens Ninja (Bypass)** regalados a <@${targetUser.id}>.\n` +
    `📊 Balance actual: Diarios \`${updated.base_tokens}\` | Ninja \`${updated.gift_bp}\``
  );
}

async function handleBan(message) {
  const userId = message.author.id;
  if (!isOwner(userId)) return;

  const targetUser = message.mentions.users.first();
  if (!targetUser) return message.reply('⚠️ Menciona un usuario. Ejemplo: `#ban @ninja`');

  ensureUser(targetUser.id);
  stmt.restrictUser.run(targetUser.id);

  return message.reply(`🚫 <@${targetUser.id}> ha sido restringido. No puede usar la IA hasta que uses \`#unban\`.`);
}

async function handleUnban(message) {
  const userId = message.author.id;
  if (!isOwner(userId)) return;

  const targetUser = message.mentions.users.first();
  if (!targetUser) return message.reply('⚠️ Menciona un usuario. Ejemplo: `#unban @ninja`');

  ensureUser(targetUser.id);
  stmt.unrestrictUser.run(targetUser.id);
  stmt.upsertBan.run(targetUser.id, null);

  return message.reply(`✅ <@${targetUser.id}> ha recuperado el acceso a la IA.`);
}

async function handleClean(message) {
  const userId = message.author.id;
  if (!isOwner(userId)) return;

  const targetUser = message.mentions.users.first();
  if (!targetUser) return message.reply('⚠️ Menciona un usuario. Ejemplo: `#clean @ninja`');

  ensureUser(targetUser.id);
  stmt.cleanUser.run(targetUser.id);

  return message.reply(`🗑️ Balance de <@${targetUser.id}> reseteado a cero.`);
}

async function handleStatus(message) {
  const userId = message.author.id;

  if (isOwner(userId)) {
    return message.reply('♾️ **Tu Balance:** INFINITY | Tokens Ninja: INFINITY | Modo Owner activo.');
  }

  const user = ensureUser(userId);

  const embed = new EmbedBuilder()
    .setTitle('📊 Tu Balance de Energía')
    .setColor(0x2B0045)
    .addFields(
      { name: '📅 Tokens Diarios', value: `\`${user.base_tokens}\` / 10`, inline: true },
      { name: '🥷 Tokens Ninja (Gift)', value: `\`${user.gift_bp}\``, inline: true },
      { name: '🔓 Bypass Usado Hoy', value: `\`${user.bypass_used_today}\` / 3`, inline: true },
      { name: '🔒 Estado', value: user.is_restricted ? '🚫 Restringido' : '✅ Activo', inline: true },
    )
    .setFooter({ text: 'Los tokens base se resetean diariamente. Los Ninja son permanentes.' })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

module.exports = { handleGiveBase, handleGiveBypass, handleBan, handleUnban, handleClean, handleStatus };
