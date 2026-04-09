'use strict';

const { sanitizeOutput, detectMaliciousContent } = require('../modules/fileOutput');
const { alertOwner } = require('../modules/omniGuardian');

const UNWANTED_PHRASES = [
  /^(Here(?:'s| is)|Aquí tienes|Claro|Sure|Certainly|Of course|¡Claro!)[^.!?]*[.!?]\s*/gim,
  /^(I hope this helps|Espero que te sirva|Espero que esto sea útil)[^.!?]*[.!?]\s*/gim,
  /^(This code|Este código|The following code|El siguiente código)[^.!?]*[.!?]\s*/gim,
  /^(Note:|Nota:|⚠️ Note:|Important:|Importante:)[^\n]*\n/gim,
  /\n\nNote:.*$/gis,
  /\n\nThis implementation.*$/gis,
  /\n\nPlease note.*$/gis,
  /\n\nFeel free.*$/gis,
  /\n\nLet me know.*$/gis,
  /\n\nIf you need.*$/gis,
  /\n\nSi necesitas.*$/gis,
  /\n\nCualquier duda.*$/gis,
];

function stripBoilerplate(text) {
  let result = text;
  for (const pattern of UNWANTED_PHRASES) {
    result = result.replace(pattern, '');
  }
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

function enforceUTF8(text) {
  return Buffer.from(text, 'utf8').toString('utf8');
}

function stripMarkdownBlocks(text) {
  return text
    .replace(/```[\w]*\n?/g, '')
    .replace(/```/g, '')
    .trim();
}

async function formatOutput(rawOutput, userId, allowedUser = false) {
  if (!rawOutput || rawOutput.trim().length === 0) {
    return { success: false, content: null, reason: 'Empty output from Engineer Agent' };
  }

  if (detectMaliciousContent(rawOutput)) {
    await alertOwner(
      `🔴 **OMNI-GUARDIAN:** Código bloqueado en cuarentena.\n` +
      `Usuario: ${userId}\nMotivo: Patrones de ejecución remota detectados.`
    );
    return {
      success: false,
      content: null,
      reason: 'QUARANTINE: Malicious pattern detected in output.',
    };
  }

  let formatted = rawOutput;
  formatted = stripMarkdownBlocks(formatted);
  formatted = stripBoilerplate(formatted);
  formatted = sanitizeOutput(formatted);
  formatted = enforceUTF8(formatted);

  if (formatted.length === 0) {
    return { success: false, content: null, reason: 'Output empty after formatting.' };
  }

  return { success: true, content: formatted };
}

module.exports = { formatOutput, stripBoilerplate, enforceUTF8, stripMarkdownBlocks };
