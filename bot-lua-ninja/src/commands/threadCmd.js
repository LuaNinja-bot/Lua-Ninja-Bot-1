'use strict';

const { generateExecutiveSummary } = require('../agents/interfaceAgent');
const { getUserActiveThread, removeActiveThread, getThreadContext } = require('../modules/threadManager');
const { isOwner, getUserPermission, PERM } = require('../modules/permissions');
const { EmbedBuilder } = require('discord.js');

async function handleArchive(message) {
  const userId = message.author.id;
  const member = message.member || {};
  const perm = getUserPermission(member, userId);
  const ownerUser = isOwner(userId);

  if (perm === PERM.DENIED || perm === PERM.BANNED) return;

  const activeThread = getUserActiveThread(userId);
  if (!activeThread) {
    return message.reply('⚠️ No tienes un hilo de desarrollo activo.');
  }

  const history = getThreadContext(activeThread.thread_id);
  const lastCode = [...history].reverse().find(m => m.role === 'assistant');
  const codeContent = lastCode ? lastCode.content : '';
  const projectName = activeThread.thread_name || 'Proyecto Sin Nombre';

  let summary;
  try {
    summary = await generateExecutiveSummary(projectName, codeContent, 'Unknown');
  } catch {
    summary = {
      projectName,
      status: 'Finalizado',
      technologies: ['Lua'],
      description: 'Sesión de desarrollo completada.',
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('📋 Resumen Ejecutivo — Sesión Finalizada')
    .setColor(0x2B0045)
    .addFields(
      { name: '📁 Proyecto', value: summary.projectName, inline: true },
      { name: '✅ Estado', value: summary.status, inline: true },
      { name: '🛠️ Tecnologías', value: summary.technologies.join(', ') || 'N/A', inline: true },
      { name: '📝 Descripción', value: summary.description || 'Sesión completada.', inline: false },
    )
    .setFooter({ text: 'Bot Lua Ninja | Baúl de Sombras' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
  await message.channel.send(
    '💾 ¿Deseas guardar el resultado final en el Baúl Privado?\n' +
    'Usa `#save <nombre del sistema>` para guardarlo, o `#Close/hilo` para cerrar sin guardar.'
  );
}

async function handleCloseHilo(message) {
  const userId = message.author.id;
  const member = message.member || {};
  const perm = getUserPermission(member, userId);
  const ownerUser = isOwner(userId);

  if (perm === PERM.DENIED && !ownerUser) return;

  if (!message.channel.isThread()) {
    return message.reply('⚠️ Este comando solo funciona dentro de un hilo.');
  }

  const threadId = message.channelId;
  const activeThread = getUserActiveThread(userId);

  if (!activeThread && !ownerUser) {
    return message.reply('⚠️ No tienes un hilo activo registrado.');
  }

  removeActiveThread(userId);

  await message.channel.send('🔒 Hilo cerrado permanentemente. El historial queda disponible para el Owner.').catch(() => {});

  try {
    await message.channel.setArchived(true, `Hilo cerrado por ${message.author.tag}`);
    await message.channel.setLocked(true);
  } catch (err) {
    console.error('[THREAD] Error al cerrar hilo:', err.message);
  }
}

module.exports = { handleArchive, handleCloseHilo };
