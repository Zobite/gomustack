import type { ProviderType } from "../common/schema.js";

const FETCH_TIMEOUT = 30_000; // 30 seconds (OpenRouter returns 700+ models, needs more time)
const MAX_RETRIES = 1;

/** Fetch with timeout + retry */
async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) return res;

      // Don't retry auth errors
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Authentication failed (${res.status}): Invalid API key or insufficient permissions`);
      }

      if (attempt === retries) {
        throw new Error(`Provider returned ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Authentication failed")) {
        throw err;
      }
      if (attempt === retries) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Provider request timed out (30s). Check your base URL and network.");
        }
        throw new Error(`Cannot reach provider: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }
  throw new Error("Failed to fetch models after retries");
}

/** Fetch models from OpenAI-compatible API (OpenAI, Ollama, Custom) */
async function fetchOpenAICompatibleModels(apiKey: string, baseUrl: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetchWithRetry(url, { method: "GET", headers });
  const data = await res.json() as { data?: Array<{ id: string }> };

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Unexpected response format: missing 'data' array");
  }

  return data.data.map((m) => m.id);
}

/** Fetch models from OpenRouter — uses their native endpoint that returns all models */
async function fetchOpenRouterModels(apiKey: string, baseUrl: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetchWithRetry(url, { method: "GET", headers });
  const data = await res.json() as {
    data?: Array<{ id: string }>;
  };

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Unexpected response format from OpenRouter: missing 'data' array");
  }

  return data.data.map((m) => m.id);
}

/** Fetch models from Anthropic API */
async function fetchAnthropicModels(apiKey: string, baseUrl: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };

  const res = await fetchWithRetry(url, { method: "GET", headers });
  const data = await res.json() as { data?: Array<{ id: string }> };

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Unexpected response format from Anthropic");
  }

  return data.data.map((m) => m.id);
}

/** Fetch models from Google Gemini API */
async function fetchGeminiModels(apiKey: string, baseUrl: string): Promise<string[]> {
  // Gemini paginates with pageToken — fetch all pages
  let allModels: string[] = [];
  let pageToken: string | undefined;

  do {
    let url = `${baseUrl.replace(/\/$/, "")}/models?key=${apiKey}&pageSize=1000`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const res = await fetchWithRetry(url, { method: "GET" });
    const data = await res.json() as {
      models?: Array<{ name: string }>;
      nextPageToken?: string;
    };

    if (!data.models || !Array.isArray(data.models)) {
      if (allModels.length > 0) break; // already got some, stop
      throw new Error("Unexpected response format from Gemini");
    }

    allModels = allModels.concat(
      data.models.map((m) => m.name.replace("models/", "")),
    );

    pageToken = data.nextPageToken;
  } while (pageToken);

  return allModels;
}

/**
 * Fetch models from a provider.
 * Returns an array of model ID strings.
 * @throws Error with descriptive message on failure
 */
export async function fetchModelsFromProvider(
  providerType: ProviderType,
  apiKey: string,
  baseUrl: string | null,
): Promise<string[]> {
  if (!baseUrl) {
    throw new Error("Base URL is required to fetch models");
  }

  switch (providerType) {
    case "openai":
    case "ollama":
    case "custom":
      return fetchOpenAICompatibleModels(apiKey, baseUrl);

    case "openrouter":
      return fetchOpenRouterModels(apiKey, baseUrl);

    case "anthropic":
      return fetchAnthropicModels(apiKey, baseUrl);

    case "gemini":
      return fetchGeminiModels(apiKey, baseUrl);

    default:
      throw new Error(`Unsupported provider type: ${providerType}`);
  }
}
