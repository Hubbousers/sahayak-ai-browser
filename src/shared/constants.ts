// --- Constants for Sahayak Chrome Extension ---

export const STORAGE_KEYS = {
  PROFILE: 'sahayak_profile',
  SKILLS: 'sahayak_skills',
  SETTINGS: 'sahayak_settings',
  SESSIONS: 'sahayak_sessions',
  ACTIVE_SESSION_ID: 'sahayak_active_session_id',
  LANGUAGE: 'sahayak_language',
  MESSAGES: 'sahayak_messages',
  PRACTICE_RUNS: 'sahayak_practice_runs'
} as const;

export const ERROR_CODES = {
  NO_API_KEY: 'ERR_NO_API_KEY',
  API_RATE_LIMIT: 'ERR_API_RATE_LIMIT',
  API_ERROR: 'ERR_API_ERROR',
  INVALID_JSON: 'ERR_INVALID_JSON',
  ELEMENT_NOT_FOUND: 'ERR_ELEMENT_NOT_FOUND',
  BLOCKED_PAGE: 'ERR_BLOCKED_PAGE',
  PROTECTED_FIELD: 'ERR_PROTECTED_FIELD',
  CONSEQUENTIAL_ACTION: 'ERR_CONSEQUENTIAL_ACTION',
  SESSION_LOST: 'ERR_SESSION_LOST',
  CAPTURE_FAILED: 'ERR_CAPTURE_FAILED',
  UNKNOWN: 'ERR_UNKNOWN'
} as const;

export const DEFAULT_SETTINGS = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '',
  groqApiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY) || '',
  preferredLanguage: 'en' as const,
  stepLimit: 15,
  modelTier: 'lite' as const,
  safetyLevel: 'maximum' as const
};
