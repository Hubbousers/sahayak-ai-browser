import { SahayakError } from '../errors';

export interface ModelConfig {
  name: string;
  provider: 'gemini' | 'groq';
  supportsImages: boolean;
  supportsStructuredJson: boolean;
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiContent {
  role?: 'user' | 'model' | 'system';
  parts: GeminiPart[];
}

export interface GeminiOptions {
  temperature?: number;
  responseSchema?: object;
  systemInstruction?: string;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Calls Google Gemini REST generateContent API
 */
export async function geminiChat(
  modelName: string,
  contents: GeminiContent[],
  apiKey: string,
  options?: GeminiOptions
): Promise<string> {
  if (!apiKey || apiKey.trim() === '') {
    throw new SahayakError('ERR_NO_API_KEY', 'Gemini API key is missing. Please add it in Settings.');
  }

  const endpoint = `${GEMINI_API_BASE}/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const bodyPayload: Record<string, unknown> = {
    contents
  };

  const generationConfig: Record<string, unknown> = {};
  if (options?.temperature !== undefined) {
    generationConfig.temperature = options.temperature;
  }
  if (options?.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.responseSchema;
  }
  if (Object.keys(generationConfig).length > 0) {
    bodyPayload.generationConfig = generationConfig;
  }

  if (options?.systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: options.systemInstruction }]
    };
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload)
    });
  } catch (netErr) {
    throw new SahayakError(
      'ERR_NETWORK',
      'Failed to reach Gemini API. Please check your network connection.',
      undefined,
      netErr
    );
  }

  if (!response.ok) {
    let errorDetails: any = null;
    try {
      errorDetails = await response.json();
    } catch {
      // response might not be JSON
    }

    const message =
      errorDetails?.error?.message ||
      `Gemini API returned status ${response.status}: ${response.statusText}`;

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      throw new SahayakError('ERR_API_RATE_LIMIT', message, 429, { ...errorDetails, retryAfterSec: !isNaN(retryAfterSec as number) ? retryAfterSec : undefined });
    }
    if (response.status === 400 || response.status === 403) {
      throw new SahayakError('ERR_NO_API_KEY', message, response.status, errorDetails);
    }
    throw new SahayakError('ERR_API_ERROR', message, response.status, errorDetails);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof textResponse !== 'string') {
    throw new SahayakError(
      'ERR_API_ERROR',
      'Gemini API returned an empty or unparseable response structure.',
      response.status,
      data
    );
  }

  return textResponse;
}
