'use strict';

const { generatePromptEngineering } = require('../agents/engineerAgent');
const { generateTechnicalBrief } = require('../agents/interfaceAgent');
const { sendCodeResponse } = require('../modules/fileOutput');
const { getUserPermission, PERM, isOwner } = require('../modules/permissions');
const { getUserLanguage } = require('../database/db');

async function handlePromt(message, args) {
  const userId = message.author.id;
  const member = message.member || {};
  const perm = getUserPermission(member, userId);

  if (perm === PERM.DENIED || perm === PERM.BANNED) {
    return message.reply('❌ No tienes permiso para usar este comando.');
  }

  const idea = args.join(' ').trim();
  if (!idea) {
    return message.reply(
      '⚠️ Proporciona una idea para generar el prompt.\n' +
      'Ejemplo: `#promt quiero un sistema de insta movimiento en lua`'
    );
  }

  try {
    await message.react('🧠').catch(() => {});

    const brief = await generateTechnicalBrief(userId, idea, isOwner(userId), perm === PERM.NORMAL);
    const promptResult = await generatePromptEngineering(idea, brief.language);

    await message.reactions.removeAll().catch(() => {});

    const lang = getUserLanguage(userId);
    const header = lang === 'en'
      ? '🧠 **5-Star Engineering Prompt Generated**'
      : '🧠 **Prompt de Ingeniería 5 Estrellas Generado**';

    await sendCodeResponse(message.channel, promptResult, `prompt_${userId}`, { header });
  } catch (err) {
    await message.reactions.removeAll().catch(() => {});
    await message.reply(`❌ Error generando el prompt: ${err.message}`);
  }
}

module.exports = { handlePromt };
