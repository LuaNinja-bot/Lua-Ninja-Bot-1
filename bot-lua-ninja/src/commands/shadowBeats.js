'use strict';

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require('@discordjs/voice');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const play = require('play-dl');
const { stmt } = require('../database/db');
const { isOwnerOrAdmin } = require('../modules/permissions');

const sessions = new Map();
const cooldowns = new Map();

function checkCooldown(userId, action, ms) {
  const key = `${userId}_${action}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  if (now - last < ms) return false;
  cooldowns.set(key, now);
  return true;
}

function createSession(guildId) {
  return {
    player: createAudioPlayer(),
    queue: [],
    fairQueue: new Map(),
    currentSong: null,
    isRandom: false,
    connection: null,
    dashboardMsg: null,
    radioGenre: null,
  };
}

function getSession(guildId) {
  if (!sessions.has(guildId)) sessions.set(guildId, createSession(guildId));
  return sessions.get(guildId);
}

function buildDashboardEmbed(session, guildId) {
  const song = session.currentSong;
  const embed = new EmbedBuilder()
    .setTitle('🎵 Shadow-Beats | DJ Operaciones Tácticas')
    .setColor(0x1A0040)
    .setDescription(
      song
        ? `**🎶 En reproducción:**\n${song.isFavorite ? '[✦ FAVORITO GUARDADO] ' : ''}${song.title}`
        : '⏸️ Sin reproducción activa.'
    )
    .addFields(
      { name: '📂 Cola', value: session.queue.length > 0 ? `${session.queue.length} canción(s) en espera` : 'Vacía', inline: true },
      { name: '🔀 Modo', value: session.isRandom ? 'Aleatorio' : 'Secuencial', inline: true },
      { name: '📻 Radio', value: session.radioGenre ? `Género: ${session.radioGenre}` : 'Inactivo', inline: true },
    )
    .setFooter({ text: 'Bot Lua Ninja | Shadow-Beats' })
    .setTimestamp();

  return embed;
}

function buildDashboardButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sb_back').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sb_playpause').setEmoji('⏯️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sb_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sb_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sb_save').setEmoji('⭐').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sb_random').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sb_queue').setEmoji('📂').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sb_search').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

async function sendDashboard(channel, session) {
  const embed = buildDashboardEmbed(session, channel.guildId);
  const components = buildDashboardButtons();

  if (session.dashboardMsg) {
    try {
      await session.dashboardMsg.edit({ embeds: [embed], components });
      return session.dashboardMsg;
    } catch {}
  }

  const msg = await channel.send({ embeds: [embed], components });
  session.dashboardMsg = msg;
  return msg;
}

async function playSong(session, guildId, channel) {
  if (session.queue.length === 0) {
    session.currentSong = null;
    if (session.dashboardMsg) {
      await session.dashboardMsg.edit({ embeds: [buildDashboardEmbed(session, guildId)], components: buildDashboardButtons() }).catch(() => {});
    }
    return;
  }

  const song = session.isRandom
    ? session.queue.splice(Math.floor(Math.random() * session.queue.length), 1)[0]
    : session.queue.shift();

  session.currentSong = song;

  try {
    const stream = await play.stream(song.url, { quality: 2 });
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    session.player.play(resource);

    if (session.dashboardMsg) {
      await session.dashboardMsg.edit({ embeds: [buildDashboardEmbed(session, guildId)], components: buildDashboardButtons() }).catch(() => {});
    }
  } catch (err) {
    console.error('[SHADOW-BEATS] Error reproduciendo:', err.message);
    await playSong(session, guildId, channel);
  }
}

async function handlePlay(message, args) {
  const guildId = message.guild.id;
  const member = message.member;

  if (!member.voice.channel) {
    return message.reply('⚠️ Debes estar en un canal de voz para usar este comando.');
  }

  const session = getSession(guildId);

  if (!session.connection || session.connection.state.status === VoiceConnectionStatus.Destroyed) {
    session.connection = joinVoiceChannel({
      channelId: member.voice.channel.id,
      guildId,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
    session.connection.subscribe(session.player);

    session.player.on(AudioPlayerStatus.Idle, () => {
      playSong(session, guildId, message.channel).catch(() => {});
    });
  }

  const query = args.join(' ').trim();

  if (!query) {
    return sendDashboard(message.channel, session);
  }

  await message.react('🔍').catch(() => {});

  try {
    let songInfo;
    if (query.startsWith('http')) {
      const info = await play.video_info(query);
      songInfo = { title: info.video_details.title, url: query, requestedBy: message.author.id };
    } else {
      const results = await play.search(query, { source: { youtube: 'video' }, limit: 1 });
      if (!results.length) {
        await message.reactions.removeAll().catch(() => {});
        return message.reply('❌ No se encontraron resultados para tu búsqueda.');
      }
      songInfo = { title: results[0].title, url: results[0].url, requestedBy: message.author.id };
    }

    session.queue.push(songInfo);

    if (session.player.state.status === AudioPlayerStatus.Idle) {
      await playSong(session, guildId, message.channel);
    }

    await message.reactions.removeAll().catch(() => {});
    await sendDashboard(message.channel, session);

  } catch (err) {
    await message.reactions.removeAll().catch(() => {});
    await message.reply(`❌ Error al procesar la canción: ${err.message}`);
  }
}

async function handleRadio(message, args) {
  const guildId = message.guild.id;
  const session = getSession(guildId);

  if (args[0] === 'off') {
    session.radioGenre = null;
    session.isRandom = false;
    session.player.stop();
    return message.reply('📻 Radio Auto-DJ desactivado.');
  }

  const genre = args.join(' ').trim();
  if (!genre) return message.reply('⚠️ Especifica un género. Ejemplo: `#radio lofi`');

  if (!message.member.voice.channel) {
    return message.reply('⚠️ Debes estar en un canal de voz.');
  }

  session.radioGenre = genre;
  session.isRandom = true;

  if (!session.connection || session.connection.state.status === VoiceConnectionStatus.Destroyed) {
    session.connection = joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
    session.connection.subscribe(session.player);
    session.player.on(AudioPlayerStatus.Idle, () => {
      playSong(session, guildId, message.channel).catch(() => {});
    });
  }

  await message.reply(`🎵 Auto-DJ iniciado en modo **${genre}**. Buscando canciones...`);

  try {
    const results = await play.search(genre, { source: { youtube: 'video' }, limit: 10 });
    for (const r of results) {
      session.queue.push({ title: r.title, url: r.url, requestedBy: message.author.id });
    }
    await playSong(session, guildId, message.channel);
    await sendDashboard(message.channel, session);
  } catch (err) {
    await message.reply(`❌ Error en Auto-DJ: ${err.message}`);
  }
}

async function handleBoard(message) {
  const session = getSession(message.guild.id);
  session.dashboardMsg = null;
  await sendDashboard(message.channel, session);
}

async function handleClearMs(message) {
  const userId = message.author.id;
  const member = message.member || {};
  if (!isOwnerOrAdmin(member, userId)) return message.reply('❌ Solo Staff/Owner.');
  if (!message.member.voice.channel) return message.reply('⚠️ Debes estar en un canal de voz.');

  const session = getSession(message.guild.id);
  session.queue = [];
  return message.reply('🗑️ Cola de reproducción limpiada.');
}

async function handleFavs(message) {
  const userId = message.author.id;
  const favorites = stmt.getFavorites.all(userId);

  if (!favorites.length) {
    return message.reply('📭 Tu playlist personal está vacía. Guarda canciones con el botón ⭐ en la Dashboard.');
  }

  const session = getSession(message.guild.id);
  for (const fav of favorites) {
    session.queue.push({ title: fav.song_title, url: fav.song_url, requestedBy: userId, isFavorite: true });
  }

  await message.reply(`📂 Cargando tu colección privada... \`${favorites.length}\` canción(s) añadida(s).`);

  if (session.player.state.status === AudioPlayerStatus.Idle) {
    await playSong(session, message.guild.id, message.channel);
  }

  await sendDashboard(message.channel, session);
}

async function handleButtonInteraction(interaction) {
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const session = getSession(guildId);
  const customId = interaction.customId;

  if (customId === 'sb_stop') {
    if (!checkCooldown(userId, 'stop', 1500)) {
      return interaction.reply({ content: '⏳ Cooldown activo (1.5s)', ephemeral: true });
    }
    session.player.stop();
    session.queue = [];
    await interaction.update({ embeds: [buildDashboardEmbed(session, guildId)], components: buildDashboardButtons() });
  }

  if (customId === 'sb_skip') {
    if (!checkCooldown(userId, 'skip', 5000)) {
      return interaction.reply({ content: '⏳ Cooldown activo (5s)', ephemeral: true });
    }
    session.player.stop();
    await interaction.update({ embeds: [buildDashboardEmbed(session, guildId)], components: buildDashboardButtons() });
  }

  if (customId === 'sb_random') {
    if (!checkCooldown(userId, 'random', 60000)) {
      return interaction.reply({ content: '⏳ Cooldown activo (60s)', ephemeral: true });
    }
    session.isRandom = !session.isRandom;
    await interaction.update({ embeds: [buildDashboardEmbed(session, guildId)], components: buildDashboardButtons() });
  }

  if (customId === 'sb_playpause') {
    if (session.player.state.status === AudioPlayerStatus.Playing) {
      session.player.pause();
    } else {
      session.player.unpause();
    }
    await interaction.update({ embeds: [buildDashboardEmbed(session, guildId)], components: buildDashboardButtons() });
  }

  if (customId === 'sb_back') {
    await interaction.reply({ content: 'ℹ️ No hay canción anterior en el buffer.', ephemeral: true });
  }

  if (customId === 'sb_queue') {
    const upNext = session.queue.slice(0, 5);
    const display = upNext.length > 0
      ? upNext.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
      : 'La cola está vacía.';
    await interaction.reply({ content: `📂 **Próximas canciones:**\n${display}`, ephemeral: true });
  }

  if (customId === 'sb_save') {
    const current = session.currentSong;
    if (!current) return interaction.reply({ content: '⚠️ No hay canción en reproducción.', ephemeral: true });
    stmt.addFavorite.run(userId, current.title, current.url);
    await interaction.reply({ content: '✅ Canción añadida a tu Shadow Playlist personal.', ephemeral: true });
  }

  if (customId === 'sb_search') {
    await interaction.reply({
      content: '🔍 Usa `#play <nombre o link>` para buscar y añadir canciones a la cola.',
      ephemeral: true,
    });
  }
}

module.exports = {
  handlePlay,
  handleRadio,
  handleBoard,
  handleClearMs,
  handleFavs,
  handleButtonInteraction,
};
