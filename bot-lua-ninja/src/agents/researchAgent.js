'use strict';

const { callResearchAPI } = require('../modules/apiClient');
const axios = require('axios');
const config = require('../config');

async function searchWeb(query) {
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: query + ' 2026 documentation site:roblox.com OR site:create.roblox.com OR site:devforum.roblox.com OR site:github.com',
        api_key: config.search.serpApiKey,
        num: 5,
        hl: 'en',
        gl: 'us',
      },
      timeout: 10000,
    });

    const results = response.data.organic_results || [];
    return results.slice(0, 4).map(r => ({
      title: r.title,
      snippet: r.snippet,
      link: r.link,
    }));
  } catch {
    return [];
  }
}

async function researchDocumentation(query, language) {
  if (!query || query.length < 3) return null;

  let systemPrompt = `You are the Research Agent — an expert at finding precise, up-to-date technical documentation.
Today's date: ${new Date().toISOString().split('T')[0]}.
Your task: Search for the most current (2026) API documentation, syntax, and best practices for: "${query}"
Focus on: ${language || 'Roblox Lua/Luau'}.
Return a concise technical summary with:
- Current API methods/functions (with correct 2026 syntax)
- Deprecated functions to AVOID
- Best practices
- Any breaking changes since 2024
Keep it pure technical documentation. No conversational text.`;

  try {
    const webResults = await searchWeb(query);
    let contextFromWeb = '';
    if (webResults.length > 0) {
      contextFromWeb = '\n\nSearch results:\n' + webResults.map(r =>
        `[${r.title}] ${r.snippet} (${r.link})`
      ).join('\n');
    }

    const result = await callResearchAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Research query: ${query}${contextFromWeb}` },
    ], { agentName: 'Investigador', maxTokens: 1024 });

    return result;
  } catch (err) {
    console.error('[RESEARCH] Error en investigación:', err.message);
    return null;
  }
}

module.exports = { researchDocumentation };
