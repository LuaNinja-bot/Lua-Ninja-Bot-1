'use strict';

const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const TMP_DIR = path.join(__dirname, '../../tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const MARKDOWN_PATTERNS = [
  /```[\w]*\n?/g,
  /```/g,
  /\*\*(.*?)\*\*/g,
  /__(.*?)__/g,
  /\*(.*?)\*/g,
  /_(.*?)_/g,
  /^#{1,6}\s+/gm,
  /^>\s+/gm,
  /^\s*[-*+]\s+/gm,
  /^\s*\d+\.\s+/gm,
  /\[([^\]]+)\]\([^)]+\)/g,
  /~~(.*?)~~/g,
];

const BOILERPLATE_PATTERNS = [
  /^(Aquí tienes|Here you go|Here is|Espero que te sirva|Hope this helps|I hope this|Claro que sí|¡Claro!|Sure!|Certainly!|Of course!)[^.]*\./gim,
  /^(Esta es la|This is the|El siguiente código|The following code)[^.]*\./gim,
  /^(Nota:|Note:|Aviso:|Warning:)[^\n]*\n/gim,
];

const INJECTION_PATTERNS = [
  /rm\s+-rf\s+\//gi,
  /os\.system\s*\(/gi,
  /subprocess\.(?:call|run|Popen)\s*\([^)]*(?:shell\s*=\s*True)/gi,
  /exec\s*\(\s*(?:request|input|user)/gi,
  /eval\s*\(\s*(?:request|input|user)/gi,
  /\$\(.*?\)/g,
  /`[^`]*`/g,
];

function sanitizeOutput(text) {
  let clean = text;

  for (const pattern of BOILERPLATE_PATTERNS) {
    clean = clean.replace(pattern, '');
  }

  for (const pattern of MARKDOWN_PATTERNS) {
    if (pattern.source.includes('(.*?)')) {
      clean = clean.replace(pattern, '$1');
    } else {
      clean = clean.replace(pattern, '');
    }
  }

  clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  clean = clean.trim();

  return clean;
}

function detectMaliciousContent(text) {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  if (Buffer.byteLength(text, 'utf8') > 1024 * 1024) return true;
  return false;
}

function createTxtFile(content, filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 60);
  const filePath = path.join(TMP_DIR, `${safeName}_${Date.now()}.txt`);
  const cleanContent = sanitizeOutput(content);
  fs.writeFileSync(filePath, cleanContent, { encoding: 'utf8' });
  return filePath;
}

function buildDiscordAttachment(content, filename) {
  const filePath = createTxtFile(content, filename);
  const attachment = new AttachmentBuilder(filePath, {
    name: path.basename(filePath),
    description: 'Código generado por Bot Lua Ninja',
  });
  return { attachment, filePath };
}

function shouldUseFile(content) {
  return content.length > 1500;
}

async function sendCodeResponse(channel, content, filename = 'output', opts = {}) {
  const clean = sanitizeOutput(content);
  const { header } = opts;

  if (shouldUseFile(clean)) {
    const { attachment, filePath } = buildDiscordAttachment(clean, filename);
    const msg = await channel.send({
      content: header || '📄 El resultado está adjunto en el archivo de texto:',
      files: [attachment],
    });
    setTimeout(() => {
      try { fs.unlinkSync(filePath); } catch {}
    }, 30000);
    return msg;
  } else {
    return channel.send({
      content: header ? `${header}\n\`\`\`\n${clean}\n\`\`\`` : `\`\`\`\n${clean}\n\`\`\``,
    });
  }
}

function cleanupTmpFiles() {
  const files = fs.readdirSync(TMP_DIR);
  const cutoff = Date.now() - 300000;
  for (const file of files) {
    const fp = path.join(TMP_DIR, file);
    try {
      const stat = fs.statSync(fp);
      if (stat.mtimeMs < cutoff) fs.unlinkSync(fp);
    } catch {}
  }
}

setInterval(cleanupTmpFiles, 300000);

module.exports = {
  sanitizeOutput,
  detectMaliciousContent,
  createTxtFile,
  buildDiscordAttachment,
  shouldUseFile,
  sendCodeResponse,
};
