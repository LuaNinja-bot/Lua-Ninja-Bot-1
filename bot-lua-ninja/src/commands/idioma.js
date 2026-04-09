'use strict';

const { stmt, ensureUser } = require('../database/db');
const { getUserPermission, PERM } = require('../modules/permissions');

const SUPPORTED_LANGUAGES = {
  'español': 'es', 'spanish': 'es', 'es': 'es',
  'english': 'en', 'inglés': 'en', 'ingles': 'en', 'en': 'en',
  'português': 'pt', 'portuguese': 'pt', 'portugues': 'pt', 'pt': 'pt',
  'français': 'fr', 'french': 'fr', 'fr': 'fr',
  'deutsch': 'de', 'german': 'de', 'de': 'de',
};

async function handleIdioma(message, args) {
  const userId = message.author.id;
  const member = message.member || {};
  const perm = getUserPermission(member, userId);

  if (perm === PERM.DENIED || perm === PERM.BANNED) {
    return message.reply('❌ No tienes permiso para usar este comando.');
  }

  if (!args || args.length === 0) {
    return message.reply(
      '⚠️ Especifica un idioma. Ejemplo: `#Idioma Español` o `#Idioma English`\n' +
      'Idiomas disponibles: Español, English, Português, Français, Deutsch'
    );
  }

  const lang = args[0].toLowerCase();
  const langCode = SUPPORTED_LANGUAGES[lang];

  if (!langCode) {
    return message.reply(
      `❌ Idioma \`${args[0]}\` no reconocido.\nDisponibles: Español, English, Português, Français, Deutsch`
    );
  }

  ensureUser(userId);
  stmt.updateLanguage.run(langCode, userId);

  const confirmations = {
    es: '✅ Idioma configurado a **Español** para tu perfil.',
    en: '✅ Language set to **English** for your profile.',
    pt: '✅ Idioma configurado para **Português** no seu perfil.',
    fr: '✅ Langue configurée en **Français** pour votre profil.',
    de: '✅ Sprache wurde auf **Deutsch** für Ihr Profil eingestellt.',
  };

  return message.reply(confirmations[langCode] || `✅ Idioma actualizado a \`${langCode}\`.`);
}

module.exports = { handleIdioma };
