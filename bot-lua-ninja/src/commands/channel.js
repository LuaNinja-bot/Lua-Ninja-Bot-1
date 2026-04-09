'use strict';

const { ChannelType } = require('discord.js');
const { isOwnerOrAdmin } = require('../modules/permissions');

async function handleChannel(message) {
  const userId = message.author.id;
  const member = message.member || {};

  if (!isOwnerOrAdmin(member, userId)) {
    return message.reply('❌ Solo Owner/Admin pueden usar este comando.');
  }

  const channel = message.channel;
  if (channel.type !== ChannelType.GuildText) {
    return message.reply('⚠️ Este comando solo funciona en canales de texto de servidor.');
  }

  try {
    await message.reply('🔄 Reiniciando canal... Esto tomará unos segundos.');

    const name = channel.name;
    const topic = channel.topic;
    const position = channel.position;
    const parent = channel.parent;
    const permOverwrites = channel.permissionOverwrites.cache.map(ow => ({
      id: ow.id,
      type: ow.type,
      allow: ow.allow,
      deny: ow.deny,
    }));
    const nsfw = channel.nsfw;
    const rateLimitPerUser = channel.rateLimitPerUser;

    await channel.clone({
      name,
      topic,
      position,
      parent,
      permissionOverwrites: permOverwrites,
      nsfw,
      rateLimitPerUser,
      reason: `Canal reiniciado por ${message.author.tag}`,
    }).then(async newChannel => {
      await newChannel.setPosition(position);
      await newChannel.send(`✅ Canal reiniciado exitosamente por <@${userId}>.\nHistorial anterior eliminado.`);
    });

    await channel.delete(`Canal reiniciado por ${message.author.tag}`);

  } catch (err) {
    console.error('[CHANNEL] Error:', err);
    await message.reply(`❌ Error al reiniciar el canal: ${err.message}`).catch(() => {});
  }
}

module.exports = { handleChannel };
