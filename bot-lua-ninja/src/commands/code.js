'use strict';

const { generateTechnicalBrief } = require('../agents/interfaceAgent');
const { researchDocumentation } = require('../agents/researchAgent');
const { generateCode } = require('../agents/engineerAgent');
const { formatOutput } = require('../agents/formatterAgent');
const { sendCodeResponse } = require('../modules/fileOutput');
const {
  createPrivateThread,
  sendWelcomeMessage,
  getUserActiveThread,
  addToThreadContext,
  getThreadContext,
} = require('../modules/threadManager');
const { isOwner, checkBypassAvailable, checkTokenAvailable, getUserPermission, PERM } = require('../modules/permissions');
const { stmt, ensureUser } = require('../database/db');
const { checkSpamAndBan } = require('../modules/omniGuardian');

async function handleCode(message, args, isBypass, client) {
  const userId = message.author.id;
  const member = message.member || { roles: { cache: new Map() }, permissions: null };

  const ownerUser = isOwner(userId);
  const perm = getUserPermission(member, userId);

  if (perm === PERM.BANNED) {
    return message.reply('🚫 Tu acceso está bloqueado temporalmente por peticiones masivas. Espera 24 horas.');
  }

  if (perm === PERM.DENIED) {
    return message.reply('❌ No tienes permiso para usar este comando. Solicita acceso al Owner.');
  }

  if (!ownerUser) {
    const spamDetected = await checkSpamAndBan(userId, member);
    if (spamDetected) {
      return message.reply(
        '🚫 Has sido bloqueado por spam. Realizaste demasiadas peticiones en muy poco tiempo.\n' +
        'Tu acceso ha sido suspendido por 24 horas.'
      );
    }
  }

  const instruction = args.join(' ').trim();
  if (!instruction) {
    return message.reply('⚠️ Debes incluir una instrucción. Ejemplo: `#code Un sistema de movimiento en Lua`');
  }

  const existingThread = getUserActiveThread(userId);
  if (existingThread && !message.channel.isThread()) {
    return message.reply(
      '⚠️ Ya tienes un hilo de desarrollo abierto. Por favor, termina el actual o úsalo para seguir programando.\n' +
      `Accede a tu hilo activo: <#${existingThread.thread_id}>`
    );
  }

  if (isBypass) {
    if (!ownerUser) {
      const bypassCheck = checkBypassAvailable(userId);
      if (!bypassCheck.allowed) {
        return message.reply(bypassCheck.reason);
      }
    }
  } else {
    if (!ownerUser) {
      const tokenCheck = checkTokenAvailable(userId);
      if (!tokenCheck.allowed) {
        return message.reply(tokenCheck.reason);
      }
    }
  }

  const isNormalUser = perm === PERM.NORMAL;
  let thread;

  try {
    await message.react('⚙️').catch(() => {});

    const brief = await generateTechnicalBrief(userId, instruction, ownerUser, isNormalUser);

    if (brief.languageDenied && !ownerUser) {
      await message.reactions.removeAll().catch(() => {});
      return message.reply(
        '❌ **Acceso denegado:** Los usuarios con rol normal solo pueden generar scripts de **Roblox/Lua**.\n' +
        'Cualquier otro lenguaje está prohibido para tu nivel de acceso.'
      );
    }

    if (message.channel.isThread() && existingThread) {
      thread = message.channel;
    } else {
      thread = await createPrivateThread(message, instruction);
      await sendWelcomeMessage(thread, message.member || { user: message.author });
    }

    let researchContext = null;
    if (brief.needsResearch && brief.researchQuery) {
      researchContext = await researchDocumentation(brief.researchQuery, brief.language);
    }

    const history = getThreadContext(thread.id);

    const { code, apiUsed } = await generateCode(
      brief.brief,
      researchContext,
      history,
      ownerUser,
      isBypass
    );

    const formatted = await formatOutput(code, userId, ownerUser);

    if (!formatted.success) {
      await thread.send(`🔴 **GUARDIAN:** El código fue bloqueado en cuarentena.\nMotivo: ${formatted.reason}`);
      return;
    }

    if (!ownerUser) {
      if (isBypass) {
        stmt.deductBypassTokens.run(userId);
      } else {
        stmt.deductBaseToken.run(userId);
      }
    }

    addToThreadContext(thread.id, 'user', instruction);
    addToThreadContext(thread.id, 'assistant', formatted.content);

    const user = ensureUser(userId);
    const tokenInfo = ownerUser
      ? '♾️ **INFINITY** (Owner)'
      : `📊 Tokens: Diarios \`${user.base_tokens}\` | Ninja \`${user.gift_bp}\``;

    await sendCodeResponse(thread, formatted.content, `code_${userId}`, {
      header: `✅ **Código generado** | API: \`${apiUsed}\`\n${tokenInfo}`,
    });

    await message.reactions.removeAll().catch(() => {});

  } catch (err) {
    console.error('[CODE] Error:', err);
    const errMsg = `❌ Error en el pipeline de generación: ${err.message}`;
    if (thread) {
      await thread.send(errMsg).catch(() => {});
    } else {
      await message.reply(errMsg).catch(() => {});
    }
    await message.reactions.removeAll().catch(() => {});
  }
}

async function handleThreadMessage(message) {
  const userId = message.author.id;
  if (message.author.bot) return;

  const ownerUser = isOwner(userId);
  const perm = getUserPermission(message.member || {}, userId);
  if (perm === PERM.DENIED || perm === PERM.BANNED) return;

  if (!ownerUser) {
    const tokenCheck = checkTokenAvailable(userId);
    if (!tokenCheck.allowed) {
      return message.reply(tokenCheck.reason);
    }
  }

  const instruction = message.content.trim();
  if (!instruction || instruction.startsWith('#')) return;

  try {
    await message.react('⚙️').catch(() => {});

    const history = getThreadContext(message.channelId);
    const { researchDocumentation } = require('../agents/researchAgent');
    const brief = await generateTechnicalBrief(userId, instruction, ownerUser, perm === PERM.NORMAL);

    let researchContext = null;
    if (brief.needsResearch) {
      researchContext = await researchDocumentation(brief.researchQuery, brief.language);
    }

    const { code } = await generateCode(brief.brief, researchContext, history, ownerUser, false);
    const formatted = await formatOutput(code, userId, ownerUser);

    if (!formatted.success) {
      return message.reply(`🔴 Código bloqueado: ${formatted.reason}`);
    }

    if (!ownerUser) stmt.deductBaseToken.run(userId);

    addToThreadContext(message.channelId, 'user', instruction);
    addToThreadContext(message.channelId, 'assistant', formatted.content);

    const user = ensureUser(userId);
    const tokenInfo = ownerUser
      ? '♾️ **INFINITY**'
      : `📊 Diarios: \`${user.base_tokens}\` | Ninja: \`${user.gift_bp}\``;

    await sendCodeResponse(message.channel, formatted.content, `iter_${userId}`, {
      header: `✅ **Iteración completada** | ${tokenInfo}`,
    });

    await message.reactions.removeAll().catch(() => {});
  } catch (err) {
    await message.reply(`❌ Error: ${err.message}`).catch(() => {});
    await message.reactions.removeAll().catch(() => {});
  }
}

module.exports = { handleCode, handleThreadMessage };
