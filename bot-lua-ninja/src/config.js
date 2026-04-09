'use strict';

require('dotenv').config();
const crypto = require('crypto');

function _dec(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf8');
}

function _hashSHA256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const REQUIRED_VARS = [
  'DISCORD_TOKEN',
  '_OWN',
  'SECRET_SALT',
  '_RID',
  '_VID',
  'GHOST_KEY_HASH',
  'MASTER_UNLOCK_HASH',
  'OPENROUTER_API_KEY',
  'FALLBACK_API_KEY',
  'FALLBACK2_API_KEY',
  'INTERFACE_API_KEY',
  'RESEARCH_API_KEY',
];

function validateEnvironment() {
  const missing = [];
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length > 0) {
    console.error(`\n[FATAL] Variables de entorno faltantes: ${missing.join(', ')}`);
    console.error('[FATAL] El bot no puede iniciar sin todas las variables requeridas.');
    process.exit(1);
  }
  console.log('[CONFIG] Validación de entorno completada. Todas las variables presentes.');
}

const config = {
  validateEnvironment,

  discord: {
    token: process.env.DISCORD_TOKEN,
  },

  ids: {
    get owner() { return _dec(process.env._OWN); },
    get normalRole() { return _dec(process.env._RID); },
    get vaultChannel() { return _dec(process.env._VID); },
    logChannel: process.env.LOG_CHANNEL_ID,
  },

  security: {
    salt: process.env.SECRET_SALT,
    ghostKeyHash: process.env.GHOST_KEY_HASH,
    masterUnlockHash: process.env.MASTER_UNLOCK_HASH,
    verifyGhostKey: (input) => {
      const inputHash = _hashSHA256(input.toString().trim() + process.env.SECRET_SALT);
      return inputHash === process.env.GHOST_KEY_HASH;
    },
    verifyMasterUnlock: (input) => {
      const inputHash = _hashSHA256(input.toString().trim());
      return inputHash === process.env.MASTER_UNLOCK_HASH;
    },
  },

  apis: {
    primary: {
      key: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.PRIMARY_MODEL || 'meta-llama/llama-3.1-405b-instruct',
      name: 'Llama-405B (OpenRouter)',
    },
    fallback: {
      key: process.env.FALLBACK_API_KEY,
      baseUrl: process.env.FALLBACK_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.FALLBACK_MODEL || 'gpt-4o',
      name: 'GPT-4o (OpenAI)',
    },
    fallback2: {
      key: process.env.FALLBACK2_API_KEY,
      baseUrl: process.env.FALLBACK2_BASE_URL || 'https://api.groq.com/openai/v1',
      model: process.env.FALLBACK2_MODEL || 'llama3-70b-8192',
      name: 'Llama-70B (Groq)',
    },
    interface: {
      key: process.env.INTERFACE_API_KEY,
      baseUrl: process.env.INTERFACE_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.INTERFACE_MODEL || 'gpt-4o-mini',
      name: 'GPT-4o-mini (Interfaz)',
    },
    research: {
      key: process.env.RESEARCH_API_KEY,
      baseUrl: process.env.RESEARCH_BASE_URL || 'https://api.perplexity.ai',
      model: process.env.RESEARCH_MODEL || 'sonar',
      name: 'Sonar (Perplexity)',
    },
  },

  search: {
    serpApiKey: process.env.SERP_API_KEY,
  },

  system: {
    port: parseInt(process.env.PORT) || 3000,
    apiTimeout: parseInt(process.env.API_TIMEOUT_MS) || 15000,
    maxRetries: parseInt(process.env.API_MAX_RETRIES) || 10,
    maxResponseChars: parseInt(process.env.MAX_RESPONSE_CHARS) || 1500,
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL_MS) || 840000,
    raidThreshold: parseInt(process.env.RAID_THRESHOLD) || 10,
    spamThreshold: parseInt(process.env.SPAM_THRESHOLD) || 5,
    spamWindowMs: parseInt(process.env.SPAM_WINDOW_MS) || 60000,
    banDurationHours: parseInt(process.env.BAN_DURATION_HOURS) || 24,
    baseTokensDaily: parseInt(process.env.BASE_TOKENS_DAILY) || 10,
    bypassTokensDefault: parseInt(process.env.BYPASS_TOKENS_DEFAULT) || 3,
  },
};

module.exports = config;
