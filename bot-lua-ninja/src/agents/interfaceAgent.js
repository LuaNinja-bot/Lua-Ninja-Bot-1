'use strict';

const { callInterfaceAPI } = require('../modules/apiClient');
const { getUserLanguage } = require('../database/db');

async function generateTechnicalBrief(userId, userMessage, isOwner, isNormalUser) {
  const lang = getUserLanguage(userId);

  const systemPrompt = `You are the Interface Agent of Bot Lua Ninja — a precision software engineering assistant.
Your job is to:
1. Strip conversational "noise" from the user's message.
2. Detect the programming language being requested.
3. Generate a clean Technical Brief in English.
4. Determine if a web research query is needed.

${isNormalUser && !isOwner ? `RESTRICTION: Normal users can ONLY request Roblox/Lua scripts. If the request is for any other language, return: LANGUAGE_DENIED` : ''}
${isOwner ? `UNRESTRICTED MODE: Owner has full access. No language or content restrictions apply.` : ''}

Output format (JSON only, no markdown):
{
  "language": "Lua/Roblox",
  "objective": "brief one-sentence objective",
  "dependencies": ["lib1", "lib2"],
  "needsResearch": true/false,
  "researchQuery": "precise search query for up-to-date 2026 docs",
  "brief": "full technical brief in English",
  "userLanguage": "${lang}",
  "languageDenied": false
}`;

  const response = await callInterfaceAPI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], { agentName: 'Interfaz' });

  try {
    const jsonMatch = response.match(/\{[\s\S]+\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      language: 'Unknown',
      objective: userMessage.substring(0, 100),
      dependencies: [],
      needsResearch: false,
      researchQuery: userMessage,
      brief: userMessage,
      userLanguage: lang,
      languageDenied: false,
    };
  }
}

async function generateExecutiveSummary(projectName, codeContent, language) {
  const prompt = `Generate a brief executive project summary in JSON format:
{
  "projectName": "${projectName}",
  "status": "Finalizado/Funcional",
  "technologies": ["list", "of", "technologies"],
  "description": "one paragraph description of what was built"
}
Code analyzed: ${codeContent.substring(0, 1000)}`;

  try {
    const response = await callInterfaceAPI([
      { role: 'system', content: 'You are a technical project summarizer. Output JSON only.' },
      { role: 'user', content: prompt },
    ]);
    const jsonMatch = response.match(/\{[\s\S]+\}/);
    if (!jsonMatch) throw new Error('No JSON');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      projectName,
      status: 'Finalizado/Funcional',
      technologies: [language],
      description: 'Sesión de desarrollo completada.',
    };
  }
}

module.exports = { generateTechnicalBrief, generateExecutiveSummary };
