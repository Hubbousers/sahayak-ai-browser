import { SahayakError } from '../errors';

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqOptions {
  temperature?: number;
  responseFormatJson?: boolean;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Calls Groq OpenAI-compatible Chat Completions API
 * Default model: llama-3.1-8b-instant (fast, reliable text fallback)
 */
export async function groqChat(
  modelName: string,
  messages: GroqChatMessage[],
  apiKey: string,
  options?: GroqOptions
): Promise<string> {
  if (!apiKey || apiKey.trim() === '') {
    throw new SahayakError(
      'ERR_NO_API_KEY',
      'Groq API key is missing. Please add it in Settings for fallback support.'
    );
  }

  const payload: Record<string, unknown> = {
    model: modelName || 'llama-3.1-8b-instant',
    messages,
    temperature: options?.temperature !== undefined ? options.temperature : 0.4
  };

  if (options?.responseFormatJson) {
    payload.response_format = { type: 'json_object' };
  }

  let response: Response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr) {
    throw new SahayakError(
      'ERR_NETWORK',
      'Failed to reach Groq API. Please check your network connection.',
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
      `Groq API returned status ${response.status}: ${response.statusText}`;

    if (response.status === 429) {
      throw new SahayakError('ERR_API_RATE_LIMIT', message, 429, errorDetails);
    }
    if (response.status === 401 || response.status === 403) {
      throw new SahayakError('ERR_NO_API_KEY', message, response.status, errorDetails);
    }
    throw new SahayakError('ERR_API_ERROR', message, response.status, errorDetails);
  }

  const data = await response.json();
  const textResponse = data.choices?.[0]?.message?.content;

  if (typeof textResponse !== 'string') {
    throw new SahayakError(
      'ERR_API_ERROR',
      'Groq API returned an empty or unparseable response structure.',
      response.status,
      data
    );
  }

  return textResponse;
}
