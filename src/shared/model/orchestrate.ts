import { ModelConfig, GeminiContent, GeminiOptions, geminiChat } from './geminiClient';
import { groqChat, GroqChatMessage, GroqOptions } from './groqClient';
import { SahayakError, buildUserFriendlyError } from '../errors';

export type ModelTier = 'lite' | 'standard' | 'vision' | 'fallback';

export interface ModelIntent {
  kind:
  | 'explain'
  | 'summarize'
  | 'chat'
  | 'translate'
  | 'draftReply'
  | 'find_it'
  | 'agent_next_action'
  | 'structured_json'
  | 'screenshot';
  hasImage?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export const MODELS: Record<ModelTier, ModelConfig> = {
  lite: {
    name: 'gemini-3.5-flash-lite',
    provider: 'gemini',
    supportsImages: false,
    supportsStructuredJson: true
  },
  standard: {
    name: 'gemini-3.8-flash',
    provider: 'gemini',
    supportsImages: false,
    supportsStructuredJson: true
  },
  vision: {
    name: 'gemini-3.8-flash',
    provider: 'gemini',
    supportsImages: true,
    supportsStructuredJson: true
  },
  fallback: {
    name: 'llama-3.1-8b-instant',
    provider: 'groq',
    supportsImages: false,
    supportsStructuredJson: true
  }
};

/**
 * Resolves the appropriate model tier based on task intent and difficulty.
 * - hasImage -> 'vision'
 * - hard reasoning tasks (agent_next_action, find_it, structured_json) -> 'standard'
 * - default routine tasks -> 'lite'
 */
export function resolveModel(intent: ModelIntent, preferredTier?: ModelTier): ModelTier {
  if (intent.hasImage) return 'vision';
  if (preferredTier && preferredTier !== 'vision') return preferredTier;
  if (
    ['find_it', 'agent_next_action', 'structured_json'].includes(intent.kind) &&
    intent.difficulty === 'hard'
  ) {
    return 'standard';
  }
  return 'lite';
}

export interface GenerationParams {
  contents: GeminiContent[];
  intent: ModelIntent;
  apiKey: string;
  groqApiKey?: string;
  preferredTier?: ModelTier;
  options?: GeminiOptions;
  onRetry?: (attempt: number, delaySec: number) => void;
}

export interface GenerationResult {
  text: string;
  model: string;
  tier: ModelTier;
  provider: 'gemini' | 'groq';
  success: boolean;
  usedFallback?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Converts GeminiContent[] into GroqChatMessage[] for Groq fallback.
 */
function convertGeminiToGroqMessages(contents: GeminiContent[], systemInstruction?: string): GroqChatMessage[] {
  const groqMsgs: GroqChatMessage[] = [];

  if (systemInstruction) {
    groqMsgs.push({ role: 'system', content: systemInstruction });
  }

  for (const c of contents) {
    const role: 'user' | 'assistant' = c.role === 'model' ? 'assistant' : 'user';
    const textParts = (c.parts || [])
      .map((p) => p.text || '')
      .filter(Boolean)
      .join('\n');
    if (textParts) {
      groqMsgs.push({ role, content: textParts });
    }
  }

  return groqMsgs;
}

/**
 * Orchestrates API calls with tiered model selection, exponential backoff (429/500/503),
 * user-visible countdown notices, and automatic Groq fallback when Gemini fails.
 */
export async function generateText(params: GenerationParams): Promise<GenerationResult> {
  const initialTier = resolveModel(params.intent, params.preferredTier);
  let activeTier = initialTier;
  let modelConfig = MODELS[activeTier];

  // Max tries: lite gets 3 tries, standard/vision gets 2 tries
  const maxTries = activeTier === 'lite' ? 3 : 2;
  let lastError: unknown;

  // 1. Primary execution via Gemini with exponential backoff on 429/500/503
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      const text = await geminiChat(
        modelConfig.name,
        params.contents,
        params.apiKey,
        params.options
      );

      return {
        text,
        model: modelConfig.name,
        tier: activeTier,
        provider: 'gemini',
        success: true
      };
    } catch (err: any) {
      lastError = err;
      const status = err?.status;

      // Handle rate limits (429) or temporary server errors (500-599)
      const isRateLimit = status === 429;
      const isServerError = status && status >= 500 && status < 600;

      if (isRateLimit || isServerError) {
        if (attempt < maxTries) {
          // If server provided Retry-After header, respect it; otherwise exponential backoff: 2^(i-1) * 1.5s
          const headerRetrySec = err?.details?.retryAfterSec;
          const delaySec =
            typeof headerRetrySec === 'number' && headerRetrySec > 0
              ? headerRetrySec
              : Math.max(1, Math.round(2 ** (attempt - 1) * 1.5));

          if (params.onRetry) {
            params.onRetry(attempt, delaySec);
          }
          await sleep(delaySec * 1000);
          continue;
        }
      } else {
        // Non-retryable error (e.g. 400 invalid API key, prompt format)
        break;
      }
    }
  }

  // 2. Groq Fallback: If Gemini failed and we have a Groq key (for text tasks only)
  const canFallbackToGroq =
    Boolean(params.groqApiKey && params.groqApiKey.trim()) &&
    !params.intent.hasImage &&
    params.intent.kind !== 'screenshot';

  if (canFallbackToGroq) {
    try {
      console.warn('Gemini exhausted retries. Attempting Groq fallback (llama-3.1-8b-instant)...');
      const groqModel = MODELS.fallback;
      const groqMessages = convertGeminiToGroqMessages(params.contents, params.options?.systemInstruction);

      const groqText = await groqChat(
        groqModel.name,
        groqMessages,
        params.groqApiKey!,
        {
          temperature: params.options?.temperature,
          responseFormatJson: Boolean(params.options?.responseSchema)
        }
      );

      return {
        text: groqText,
        model: groqModel.name,
        tier: 'fallback',
        provider: 'groq',
        success: true,
        usedFallback: true
      };
    } catch (groqErr) {
      console.error('Groq fallback also failed:', groqErr);
      // Retain primary Gemini error as it is usually the more informative one
    }
  }

  // 3. All attempts and fallback exhausted — build user-friendly error
  const userError = buildUserFriendlyError(lastError);
  return {
    text: '',
    model: modelConfig.name,
    tier: activeTier,
    provider: modelConfig.provider,
    success: false,
    error: userError
  };
}
