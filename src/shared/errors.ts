export class SahayakError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SahayakError';
  }
}

export function buildUserFriendlyError(error: unknown): { code: string; message: string } {
  if (error instanceof SahayakError) {
    return { code: error.code, message: error.message };
  }

  const errStr = String(error);
  if (errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('resource exhausted')) {
    return {
      code: 'ERR_API_RATE_LIMIT',
      message: 'The AI model is busy or rate-limited. Please wait a moment before trying again.'
    };
  }

  if (errStr.includes('400') || errStr.toLowerCase().includes('api_key') || errStr.toLowerCase().includes('invalid api key')) {
    return {
      code: 'ERR_NO_API_KEY',
      message: 'Invalid or missing API key. Please check your Gemini API key in Settings.'
    };
  }

  if (errStr.includes('500') || errStr.includes('503')) {
    return {
      code: 'ERR_API_ERROR',
      message: 'AI service temporarily unavailable. Please retry in a few seconds.'
    };
  }

  return {
    code: 'ERR_UNKNOWN',
    message: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
  };
}
