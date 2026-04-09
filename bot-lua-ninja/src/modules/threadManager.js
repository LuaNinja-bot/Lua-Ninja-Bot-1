'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const { stmt } = require('../database/db');

function generateThreadName(username, instruction) {
  const words = instruction
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 3)
    .join('_') || 'Project';
  return `🛠️-Dev-${username}-${words}`.substring(0, 90);
}

async function createPrivateThread(message, instruction) {
  const userId = message.author.id;
  const username = message.author.username;
  const threadName = generateThreadName(username, instruction);

  const thread = await message.startThread({
    name: threadName,
    autoArchiveDuration: 10080,
    type: ChannelType.PrivateThread,
    reason: 'Sesión de desarrollo privada - Bot Lua Ninja',
  });

  try {
    await thread.members.add(userId);
    await thread.members.add(config.ids.owner);
  } catch {}

  stmt.setActiveThread.run(userId, thread.id, threadName, message.channelId);

  return thread;
}

async function sendWelcomeMessage(thread, member) {
  const lang = require('../database/db').getUserLanguage(member.user.id);
  const welcomeMsg = lang === 'en'
    ? `🔒 **Isolated Development Environment Activated.**\n\n` +
      `Welcome, <@${member.user.id}>! This is your private workspace.\n\n` +
      `**How to use me:**\n` +
      `• Type your request directly — no need to repeat \`#code\` inside this thread.\n` +
      `• Attach a \`.txt\` or \`.lua\` file with \`#fix\` to repair existing code.\n` +
      `• Use \`#save <name>\` to save your final code to the Vault.\n` +
      `• Use \`#archive\` to close this session.\n` +
      `• Use \`#Close/hilo\` to permanently close this thread.\n\n` +
      `🔧 *Sending your instruction to the Engineer Agent...*`
    : `🔒 **Entorno de Desarrollo Aislado Activado.**\n\n` +
      `Bienvenido, <@${member.user.id}>! Este es tu espacio de trabajo privado.\n\n` +
      `**Cómo usarme:**\n` +
      `• Escribe tu petición directamente — no necesitas repetir \`#code\` dentro del hilo.\n` +
      `• Adjunta un archivo \`.txt\` o \`.lua\` con \`#fix\` para reparar código existente.\n` +
      `• Usa \`#save <nombre>\` para guardar tu código final en el Baúl.\n` +
      `• Usa \`#archive\` para cerrar la sesión con resumen ejecutivo.\n` +
      `• Usa \`#Close/hilo\` para cerrar el hilo permanentemente.\n\n` +
      `🔧 *Enviando instrucción al Agente Ingeniero...*`;

  return thread.send(welcomeMsg);
}

function getUserActiveThread(userId) {
  return stmt.getActiveThread.get(userId);
}

function removeActiveThread(userId) {
  const record = stmt.getActiveThread.get(userId);
  if (record) {
    stmt.clearThreadContext.run(record.thread_id);
    stmt.deleteActiveThread.run(userId);
  }
  return record;
}

function addToThreadContext(threadId, role, content) {
  const truncated = content.length > 8000 ? content.substring(0, 8000) + '...[truncated]' : content;
  stmt.addThreadContext.run(threadId, role, truncated);
}

function getThreadContext(threadId) {
  return stmt.getThreadContext.all(threadId);
}

module.exports = {
  generateThreadName,
  createPrivateThread,
  sendWelcomeMessage,
  getUserActiveThread,
  removeActiveThread,
  addToThreadContext,
  getThreadContext,
};
