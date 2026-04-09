'use strict';

const { OpenAI } = require('openai');
const config = require('../config');
const { stmt } = require('../database/db');

let currentApiIndex = 0;
const API_STACK = ['primary', 'fallback', 'fallback2'];
let ownerNotifyCallback = null;

function setOwnerNotifyCallback(fn) {
  ownerNotifyCallback = fn;
}

function _buildClient(apiConfig) {
  return new OpenAI({
    apiKey: apiConfig.key,
    baseURL: apiConfig.baseUrl,
    timeout: config.system.apiTimeout,
  });
}

async function _callWithRetry(apiConf, messages, options = {}, attempt = 0) {
  const client = _buildClient(apiConf);
  const start = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: apiConf.model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.2,
      ...options.extra,
    });
    const latency = Date.now() - start;
    if (options.agentName) {
      stmt.logLatency.run(options.agentName, latency);
      if (latency > 8000 && ownerNotifyCallback) {
        ownerNotifyCallback(
          `🕐 **Silent Logger:** El agente \`${options.agentName}\` tardó **${latency}ms** en responder. ` +
          `API: \`${apiConf.name}\``
        );
      }
    }
    return completion.choices[0].message.content;
  } catch (err) {
    if (attempt < config.system.maxRetries - 1) {
      await new Promise(r => setTimeout(r, 1500));
      return _callWithRetry(apiConf, messages, options, attempt + 1);
    }
    throw err;
  }
}

async function callEngineerAPI(messages, options = {}) {
  const apiKeys = API_STACK;
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[(currentApiIndex + i) % apiKeys.length];
    const apiConf = config.apis[apiKey];
    try {
      const result = await _callWithRetry(apiConf, messages, options);
      if (i > 0) {
        if (ownerNotifyCallback) {
          ownerNotifyCallback(
            `⚠️ **Cambio de API:** La API primaria \`${config.apis[API_STACK[currentApiIndex]].name}\` falló.\n` +
            `✅ Ahora usando: \`${apiConf.name}\` como respaldo.`
          );
        }
        currentApiIndex = (currentApiIndex + i) % apiKeys.length;
      }
      return { content: result, apiUsed: apiConf.name };
    } catch (err) {
      console.error(`[API] Fallo en ${apiConf.name}: ${err.message}`);
    }
  }
  throw new Error('Todas las APIs fallaron. Sistema sin conectividad.');
}

async function callInterfaceAPI(messages, options = {}) {
  const apiConf = config.apis.interface;
  return _callWithRetry(apiConf, messages, { ...options, agentName: 'Interfaz' });
}

async function callResearchAPI(messages, options = {}) {
  const apiConf = config.apis.research;
  try {
    return _callWithRetry(apiConf, messages, { ...options, agentName: 'Investigador' });
  } catch {
    return null;
  }
}

async function measureAPILatency(apiConf) {
  const start = Date.now();
  try {
    const client = _buildClient(apiConf);
    await client.chat.completions.create({
      model: apiConf.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    });
    return Date.now() - start;
  } catch (err) {
    return -1;
  }
}

async function getAllAPIStatus() {
  const results = [];
  for (const key of [...API_STACK, 'interface', 'research']) {
    const apiConf = config.apis[key];
    if (!apiConf) continue;
    const latency = await measureAPILatency(apiConf);
    results.push({
      name: apiConf.name,
      key,
      latency,
      status: latency === -1 ? '🔴 OFFLINE' : latency < 3000 ? '🟢 OK' : '🟡 LENTO',
    });
  }
  return results;
}

module.exports = {
  callEngineerAPI,
  callInterfaceAPI,
  callResearchAPI,
  getAllAPIStatus,
  measureAPILatency,
  setOwnerNotifyCallback,
};
