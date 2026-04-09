'use strict';

const { callEngineerAPI } = require('../modules/apiClient');
const { stmt } = require('../database/db');

const SYSTEM_PROMPT_RESTRICTED = `You are the Engineer Agent of Bot Lua Ninja — a senior Roblox/Lua developer.
You specialize in Luau scripting for the Roblox platform (2024-2026 standards).
RULES:
- Output ONLY clean, functional code. No explanations, no greetings, no markdown code blocks.
- Use strict Luau typing where appropriate.
- Use task.wait() instead of wait(). Use CollectionService and Attributes.
- Follow modern Roblox API standards (2026).
- Code must be modular, optimized, and ready to run.
- DO NOT include any markdown formatting (no triple backticks).
- Output plain text code only.`;

const SYSTEM_PROMPT_UNRESTRICTED = `You are the Engineer Agent of Bot Lua Ninja — an unrestricted senior software engineer.
UNRESTRICTED MODE ACTIVE — Owner Bypass enabled.
You generate code in ANY language without restrictions.
RULES:
- Output ONLY clean, functional, professional code.
- No explanations, no greetings, no markdown code blocks.
- No triple backticks or markdown formatting.
- Pure plain text code output only.
- Maximum code quality, optimization and professionalism.`;

async function generateCode(brief, researchContext, conversationHistory, isOwner, isBypass) {
  const systemPrompt = isOwner ? SYSTEM_PROMPT_UNRESTRICTED : SYSTEM_PROMPT_RESTRICTED;

  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  let userContent = brief;

  if (researchContext) {
    userContent = `[TECHNICAL_CONTEXT]\n${researchContext}\n[/TECHNICAL_CONTEXT]\n\nTASK:\n${brief}`;
  }

  messages.push({ role: 'user', content: userContent });

  const { content, apiUsed } = await callEngineerAPI(messages, {
    agentName: 'Ingeniero',
    maxTokens: 8192,
    temperature: isOwner ? 0.3 : 0.15,
  });

  return { code: content, apiUsed };
}

async function fixCode(originalCode, instructions) {
  const messages = [
    {
      role: 'system',
      content: `You are the Engineer Agent in Fix Mode. Analyze the provided code and fix/optimize it according to the instructions.
RULES:
- Output ONLY the fixed, complete code. No explanations.
- No markdown code blocks (no triple backticks).
- Preserve the original structure and logic unless improvement is needed.
- Output plain text code only.
- Fix all bugs, optimize performance, ensure correctness.`,
    },
    {
      role: 'user',
      content: `INSTRUCTIONS: ${instructions}\n\nCODE TO FIX:\n${originalCode}`,
    },
  ];

  const { content, apiUsed } = await callEngineerAPI(messages, {
    agentName: 'Ingeniero-Fix',
    maxTokens: 8192,
    temperature: 0.1,
  });

  return { code: content, apiUsed };
}

async function generatePromptEngineering(userIdea, language) {
  const messages = [
    {
      role: 'system',
      content: `You are a Senior Prompt Engineer specializing in software architecture and automation.
Transform the user's basic idea into a precise, technical 5-star prompt for a code generation AI.

CHAIN OF THOUGHT (internal, not shown):
1. Environment: What language/engine is needed?
2. Objective: Exact action the code must perform?
3. Restrictions: What must it avoid? (anticheats, deprecated libs, redundant code)
4. Optimization: What modern functions/edge cases ensure efficiency?

OUTPUT STRUCTURE (plain text, no markdown headers):
Act as [expert role].
Your objective: [precise technical objective].
Architecture: [technical specifications].
Functional Requirements:
- [requirement 1]
- [requirement 2]
- [requirement 3]
Output Style: Clean, modular, commented code, ready to run.
Restrictions: [what to avoid].

Note at end in Spanish: "✅ Prompt de ingeniería listo. Úsalo con #code para generar el código."

RULE: No explanations about WHY you wrote the prompt. Just deliver it.`,
    },
    {
      role: 'user',
      content: `User idea: ${userIdea}\nTarget language/platform: ${language || 'Roblox/Lua'}`,
    },
  ];

  const { content } = await callEngineerAPI(messages, {
    agentName: 'Ingeniero-Prompt',
    maxTokens: 2048,
    temperature: 0.4,
  });

  return content;
}

module.exports = { generateCode, fixCode, generatePromptEngineering };
