'use strict';

require('dotenv').config();
const config = require('./src/config');

config.validateEnvironment();

const { checkLockFile } = require('./src/commands/ghost');
checkLockFile();

const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
} = require('discord.js');

const { startHeartbeat } = require('./src/modules/heartbeat');
const { init: initGuardian, alertOwner, isInQuarantine, isRaidModeActive, checkSpamAndBan } = require('./src/modules/omniGuardian');
const { setOwnerNotifyCallback } = require('./src/modules/apiClient');
const { getUserActiveThread, addToThreadContext, getThreadContext } = require('./src/modules/threadManager');
const { isOwner, isOwnerOrAdmin, getUserPermission, PERM } = require('./src/modules/permissions');
const { stmt } = require('./src/database/db');

const { handleCode, handleThreadMessage } = require('./src/commands/code');
const { handleFix } = require('./src/commands/fix');
const { handleConfig, handleConfigModalSubmit } = require('./src/commands/config');
const { handleChannel } = require('./src/commands/channel');
const { handleBack } = require('./src/commands/back');
const { handleComan } = require('./src/commands/coman');
const { handleIdioma } = require('./src/commands/idioma');
const { handlePromt } = require('./src/commands/promt');
const { handleGuardian } = require('./src/commands/guardian');
const { handleSave, handleFind } = require('./src/commands/vaultCmd');
const { handleArchive, handleCloseHilo } = require('./src/commands/threadCmd');
const { handleFiltro } = require('./src/commands/filtro');
const { handleAuthorization, handlePurge, handleMasterUnlock } = require('./src/commands/ghost');
const {
  handleGiveBase,
  handleGiveBypass,
  handleBan,
  handleUnban,
  handleClean,
  handleStatus,
} = require('./src/commands/economyCmd');
const {
  handlePlay,
  handleRadio,
  handleBoard,
  handleClearMs,
  handleFavs,
  handleButtonInteraction,
} = require('./src/commands/shadowBeats');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

async function ownerDM(message) {
  try {
    const owner = await client.users.fetch(config.ids.owner);
    if (owner) await owner.send(message);
  } catch (e) {
    console.error('[DM] Error enviando DM al Owner:', e.message);
  }
}

client.once('clientReady', () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   BOT LUA NINJA — SISTEMA ONLINE         ║`);
  console.log(`║   Usuario: ${client.user.tag.padEnd(28)} ║`);
  console.log(`║   ID: ${client.user.id.padEnd(32)} ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  initGuardian(client, ownerDM);
  setOwnerNotifyCallback(ownerDM);
  startHeartbeat();

  stmt.resetDailyTokens.run();

  setInterval(() => {
    stmt.resetDailyTokens.run();
  }, 3600000);

  client.user.setActivity('🛠️ Agente de Ingeniería | #coman', { type: 4 });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const userId = message.author.id;

  if (isInQuarantine()) {
    if (!isOwner(userId)) {
      return message.reply('❌ Error 503: Connection Timeout. El servicio no está disponible temporalmente.').catch(() => {});
    }
  }

  if (isRaidModeActive()) {
    const perm = getUserPermission(message.member || {}, userId);
    if (perm === PERM.DENIED && !isOwner(userId)) {
      return message.reply('🚨 Modo Restringido activo. Solo usuarios verificados pueden usar la IA.').catch(() => {});
    }
  }

  if (message.channel.isThread()) {
    const activeThread = getUserActiveThread(userId);
    if (activeThread && activeThread.thread_id === message.channelId) {
      if (!content.startsWith('#')) {
        return handleThreadMessage(message);
      }
    }
  }

  if (!content.startsWith('#') && !content.startsWith('give ')) return;

  const withoutPrefix = content.startsWith('#') ? content.slice(1) : content;
  const parts = withoutPrefix.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'code': {
      const isBypass = content.startsWith('#code/');
      const bypassArgs = isBypass ? content.slice('#code/'.length).trim().split(/\s+/) : args;
      return handleCode(message, isBypass ? bypassArgs : args, isBypass, client);
    }

    case 'code/':
      return handleCode(message, args, true, client);

    case 'fix':
      return handleFix(message, args);

    case 'idioma':
      return handleIdioma(message, args);

    case 'promt':
    case 'prompt':
      return handlePromt(message, args);

    case 'save':
      return handleSave(message, args, client);

    case 'find':
      return handleFind(message, args, false);

    case 'find/':
      return handleFind(message, args, true);

    case 'archive':
      return handleArchive(message);

    case 'close/hilo':
      return handleCloseHilo(message);

    case 'status':
      return handleStatus(message);

    case 'config':
      if (!isOwnerOrAdmin(message.member || {}, userId)) return;
      return message.reply('⚙️ Usa `/config` como slash command para abrir el modal de configuración. (O contacta al Owner para acceso directo.)');

    case 'channel':
      return handleChannel(message);

    case 'back':
      return handleBack(message);

    case 'coman':
      return handleComan(message);

    case 'guardian':
      return handleGuardian(message, args);

    case 'filtro':
      return handleFiltro(message, args);

    case 'authorization':
      return handleAuthorization(message, args);

    case 'purge':
      return handlePurge(message);

    case 'unlock':
      return handleMasterUnlock(message, args);

    case 'play':
      return handlePlay(message, args);

    case 'radio':
      return handleRadio(message, args);

    case 'board':
      return handleBoard(message);

    case 'clear/ms':
      return handleClearMs(message);

    case 'favs':
      return handleFavs(message);

    case 'ban':
      return handleBan(message);

    case 'unban':
      return handleUnban(message);

    case 'clean':
      return handleClean(message);

    case 'give/': {
      if (!content.startsWith('#give/')) return;
      const giveArgs = content.slice('#give/'.length).trim().split(/\s+/);
      return handleGiveBypass(message, giveArgs);
    }

    default: {
      if (content.startsWith('give ') && isOwner(userId)) {
        const giveArgs = content.slice('give '.length).trim().split(/\s+/);
        return handleGiveBase(message, giveArgs);
      }
      break;
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'config_modal') {
      return handleConfigModalSubmit(interaction);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('sb_')) {
      return handleButtonInteraction(interaction);
    }
  }
});

client.on('error', (error) => {
  console.error('[CLIENT] Error del cliente Discord:', error.message);
  ownerDM(`🔴 **BOT ERROR:** ${error.message}`).catch(() => {});
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT_EXCEPTION]', err.message);
  ownerDM(`🔴 **EXCEPCIÓN CRÍTICA:** ${err.message}`).catch(() => {});
});

client.login(config.discord.token).catch((err) => {
  console.error('[FATAL] Error al iniciar sesión en Discord:', err.message);
  process.exit(1);
});
