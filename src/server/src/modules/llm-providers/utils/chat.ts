import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { eq } from "drizzle-orm";
import { getDb } from "../../../common/db/client.js";
import { llmProviders } from "../../../common/db/schema.js";
import { DEFAULT_BASE_URLS, type ProviderType } from "../common/schema.js";

// ── LLM Factory (AI SDK) ────────────────────────────────────────────────────
// Used by modules still on Vercel AI SDK (e.g. dynamic-apis coding agent).

export async function getModelForProvider(providerId: string, modelName: string): Promise<LanguageModel> {
  const db = getDb();
  const provider = db.select().from(llmProviders).where(eq(llmProviders.id, providerId)).get();
  if (!provider) throw new Error("LLM Provider not found");

  const providerType = provider.providerType as ProviderType;
  const apiKey = provider.apiKey || "sk-dummy";

  // Only use custom baseURL if user explicitly set one (not the default)
  const defaultURL = DEFAULT_BASE_URLS[providerType];
  const hasCustomBaseUrl = provider.baseUrl && provider.baseUrl !== defaultURL;

  switch (providerType) {
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey,
        ...(hasCustomBaseUrl ? { baseURL: provider.baseUrl! } : {}),
      });
      return anthropic(modelName);
    }
    case "gemini": {
      const google = createGoogleGenerativeAI({
        apiKey,
        ...(hasCustomBaseUrl ? { baseURL: provider.baseUrl! } : {}),
      });
      return google(modelName);
    }
    // openai, openrouter, ollama, custom → all OpenAI-compatible
    default: {
      const baseURL = provider.baseUrl || defaultURL || "";
      if (!baseURL) throw new Error("Cannot determine base URL for provider");
      const openai = createOpenAI({
        apiKey,
        baseURL,
      });
      return openai(modelName);
    }
  }
}

// ── LLM Factory (LangChain) ─────────────────────────────────────────────────
// Used by modules on LangChain/LangGraph (e.g. MCP coding agent).

export async function getChatModelForProvider(providerId: string, modelName: string): Promise<BaseChatModel> {
  const db = getDb();
  const provider = db.select().from(llmProviders).where(eq(llmProviders.id, providerId)).get();
  if (!provider) throw new Error("LLM Provider not found");

  const providerType = provider.providerType as ProviderType;
  const apiKey = provider.apiKey || "sk-dummy";

  const defaultURL = DEFAULT_BASE_URLS[providerType];
  const hasCustomBaseUrl = provider.baseUrl && provider.baseUrl !== defaultURL;

  switch (providerType) {
    case "anthropic": {
      return new ChatAnthropic({
        model: modelName,
        apiKey,
        ...(hasCustomBaseUrl ? { clientOptions: { baseURL: provider.baseUrl! } } : {}),
        temperature: 0.2,
      });
    }
    case "gemini": {
      return new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey,
        ...(hasCustomBaseUrl ? { baseUrl: provider.baseUrl! } : {}),
        temperature: 0.2,
      });
    }
    // openai, openrouter, ollama, custom → all OpenAI-compatible
    default: {
      const baseURL = provider.baseUrl || defaultURL || "";
      if (!baseURL) throw new Error("Cannot determine base URL for provider");
      return new ChatOpenAI({
        model: modelName,
        temperature: 0.2,
        configuration: {
          apiKey,
          baseURL,
        },
      });
    }
  }
}
