/**
 * AI gateway configuration. The app talks to an OpenAI-compatible chat
 * completions endpoint. By default that's OpenRouter, but AI_BASE_URL can point
 * it at any compatible gateway (e.g. OpenAdapter at https://api.openadapter.in/v1).
 */
const DEFAULT_AI_BASE_URL = "https://openrouter.ai/api/v1";

export function getAiBaseUrl(): string {
  const url = process.env.AI_BASE_URL?.trim();
  return (url && url.replace(/\/$/, "")) || DEFAULT_AI_BASE_URL;
}

export function getAiChatUrl(): string {
  return `${getAiBaseUrl()}/chat/completions`;
}

export function getAiModelsUrl(): string {
  return `${getAiBaseUrl()}/models`;
}

/** True when the active gateway is OpenAdapter (affects attribution headers). */
export function isOpenAdapter(): boolean {
  return /openadapter\.in/i.test(getAiBaseUrl());
}
