'use strict';

const { isOwner } = require('../modules/permissions');

let filtroActive = true;

function isFiltroActive() { return filtroActive; }

async function handleFiltro(message, args) {
  const userId = message.author.id;

  if (!isOwner(userId)) {
    return;
  }

  const sub = (args[0] || '').toLowerCase();

  if (sub === 'off') {
    filtroActive = false;
    return message.reply('⚠️ **Filtro de seguridad DESACTIVADO.** Modo sin restricciones activo para el Owner.\nUsa `#filtro on` para reactivar.');
  } else if (sub === 'on') {
    filtroActive = true;
    return message.reply('✅ **Filtro de seguridad ACTIVADO.** Sistema de tokens y restricciones restaurado.');
  } else {
    return message.reply('⚠️ Uso correcto: `#filtro on` o `#filtro off`');
  }
}

module.exports = { handleFiltro, isFiltroActive };
