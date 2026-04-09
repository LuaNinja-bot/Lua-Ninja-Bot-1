'use strict';

const { EmbedBuilder } = require('discord.js');
const { isOwnerOrAdmin } = require('../modules/permissions');

async function handleComan(message) {
  const userId = message.author.id;
  const member = message.member || {};
  const isAdmin = isOwnerOrAdmin(member, userId);

  const embed = new EmbedBuilder()
    .setTitle('📋 Bot Lua Ninja — Comandos Disponibles')
    .setColor(0x2B0045)
    .setTimestamp()
    .setFooter({ text: 'Bot Lua Ninja | Sistema Autónomo de Ingeniería' });

  embed.addFields(
    {
      name: '💻 Comandos de Usuario',
      value: [
        '`#code <instrucción>` — Genera código Roblox/Lua profesional (crea hilo privado)',
        '`#code/ <instrucción>` — Modo Bypass: sin restricciones (3 usos/día, -2 tokens)',
        '`#fix <indicación>` — Repara y optimiza código adjunto (.txt/.lua/.xml)',
        '`#Idioma <idioma>` — Cambia el idioma de respuesta (persistente por ID)',
        '`#promt <idea>` — Genera un prompt 5 estrellas de calidad técnica',
        '`#save <nombre>` — Guarda el último código en el Baúl de Sombras',
        '`#find <keyword>` — Busca código guardado en el Baúl',
        '`#find/ <nombre>` — Extrae un sistema específico del Baúl por nombre',
        '`#archive` — Cierra la sesión con resumen ejecutivo',
        '`#Close/hilo` — Cierra el hilo actual permanentemente',
        '`#status` — Muestra tu balance de tokens actual',
        '`#play <link/nombre>` — Reproduce música (Shadow-Beats)',
        '`#radio <género>` — Inicia Auto-DJ (radio sin parar)',
        '`#radio off` — Apaga el Auto-DJ',
        '`#board` — Muestra la Dashboard de audio',
        '`#favs` — Reproduce tu playlist personal guardada',
      ].join('\n'),
      inline: false,
    }
  );

  if (isAdmin) {
    embed.addFields(
      {
        name: '🛠️ Comandos de Owner/Admin',
        value: [
          '`#config` — Cambia API Key, Base URL y Modelo en vivo',
          '`#channel` — Resetea el canal (clonar + borrar historial)',
          '`#back` — Estado y latencia de todas las APIs',
          '`#coman` — Esta lista de comandos',
          '`#guardian` — Reporte completo OMNI-GUARDIAN (métricas, hilos, seguridad)',
          '`#filtro on/off` — Activa/desactiva filtros de seguridad (solo Owner)',
          '`#clear/ms` — Limpia la cola de música (solo en canal de voz)',
          '`give @user <X>` — Regala X tokens base a un usuario',
          '`#give/ @user <X>` — Regala X tokens Ninja (bypass permanentes)',
          '`#ban @user` — Restringe acceso a la IA',
          '`#unban @user` — Devuelve acceso a la IA',
          '`#clean @user` — Resetea balance completo de un usuario',
        ].join('\n'),
        inline: false,
      }
    );
  }

  embed.addFields(
    {
      name: '📊 Sistema de Tokens',
      value: [
        '• Cada usuario tiene **10 tokens base** diarios (se resetean automáticamente)',
        '• `#code` consume **1 token base**',
        '• `#code/` consume **1 token Ninja** (bypass) + **2 tokens base** si no hay Ninja',
        '• Límite de `#code/`: **3 usos por día** para usuarios normales',
        '• Owner tiene tokens **INFINITOS** — sin restricciones',
      ].join('\n'),
      inline: false,
    }
  );

  await message.reply({ embeds: [embed] });
}

module.exports = { handleComan };
