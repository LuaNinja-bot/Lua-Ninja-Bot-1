'use strict';

const { fixCode } = require('../agents/engineerAgent');
const { formatOutput } = require('../agents/formatterAgent');
const { sendCodeResponse } = require('../modules/fileOutput');
const { isOwner, getUserPermission, PERM } = require('../modules/permissions');
const axios = require('axios');

const ALLOWED_EXTENSIONS = ['.txt', '.lua', '.xml'];

async function handleFix(message, args) {
  const userId = message.author.id;
  const member = message.member || {};
  const ownerUser = isOwner(userId);
  const perm = getUserPermission(member, userId);

  if (perm === PERM.DENIED || perm === PERM.BANNED) {
    return message.reply('❌ No tienes permiso para usar este comando.');
  }

  const attachments = message.attachments;
  if (!attachments || attachments.size === 0) {
    return message.reply('📎 Debes adjuntar un archivo `.txt`, `.lua` o `.xml` con el código a reparar.');
  }

  const attachment = attachments.first();
  const filename = attachment.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some(ext => filename.endsWith(ext));

  if (!hasValidExt) {
    return message.reply('❌ Solo se aceptan archivos `.txt`, `.lua` o `.xml`.');
  }

  const instructions = args.join(' ').trim() || 'Analiza y repara el código. Corrige bugs, optimiza y mejora la estructura.';

  try {
    await message.react('🔧').catch(() => {});

    const response = await axios.get(attachment.url, {
      responseType: 'text',
      timeout: 15000,
      responseEncoding: 'utf8',
    });

    const originalCode = response.data;

    if (!originalCode || originalCode.trim().length < 5) {
      await message.reactions.removeAll().catch(() => {});
      return message.reply('⚠️ El archivo está vacío o no contiene código válido.');
    }

    const isLikelyCode = /function|local |if |while |for |return |const |let |var |def |class |import /i.test(originalCode);
    if (!isLikelyCode) {
      await message.reactions.removeAll().catch(() => {});
      return message.reply('⚠️ No se detectó código válido en el archivo adjunto.');
    }

    const { code, apiUsed } = await fixCode(originalCode, instructions);
    const formatted = await formatOutput(code, userId, ownerUser);

    if (!formatted.success) {
      await message.reactions.removeAll().catch(() => {});
      return message.reply(`🔴 El código reparado fue bloqueado: ${formatted.reason}`);
    }

    await message.reactions.removeAll().catch(() => {});
    await sendCodeResponse(message.channel, formatted.content, `fix_${userId}`, {
      header: `🔧 **Código Reparado y Optimizado** | API: \`${apiUsed}\``,
    });

  } catch (err) {
    await message.reactions.removeAll().catch(() => {});
    await message.reply(`❌ Error al procesar el archivo: ${err.message}`);
  }
}

module.exports = { handleFix };
