import {
  UserProfile,
  SavedSkill,
  ExtensionSettings,
  AgentSession,
  PracticeRun
} from './types';
import type { ChatMessage } from '../panel/components/Chat';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants';

export class TypedStorage<T> {
  constructor(private readonly key: string, private readonly defaultValue?: T) {}

  async get(): Promise<T | null> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        // Fallback for dev / mock environment without chrome extension runtime
        const item = localStorage.getItem(this.key);
        if (item) {
          try {
            resolve(JSON.parse(item));
            return;
          } catch {
            // fallback
          }
        }
        resolve(this.defaultValue ?? null);
        return;
      }

      chrome.storage.local.get([this.key], (result) => {
        if (result && result[this.key] !== undefined) {
          resolve(result[this.key]);
        } else {
          resolve(this.defaultValue ?? null);
        }
      });
    });
  }

  async set(value: T): Promise<void> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        localStorage.setItem(this.key, JSON.stringify(value));
        resolve();
        return;
      }

      chrome.storage.local.set({ [this.key]: value }, () => {
        resolve();
      });
    });
  }

  async remove(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        localStorage.removeItem(this.key);
        resolve();
        return;
      }

      chrome.storage.local.remove([this.key], () => {
        resolve();
      });
    });
  }
}

export const profileStore = new TypedStorage<UserProfile>(STORAGE_KEYS.PROFILE, {
  name: '',
  skills: [],
  links: [],
  preferredLanguage: 'en',
  preferredTone: 'friendly'
});

// Store chat messages for persistence across panel reloads
export const messagesStore = new TypedStorage<ChatMessage[]>(STORAGE_KEYS.MESSAGES, []);

export const skillsStore = new TypedStorage<SavedSkill[]>(STORAGE_KEYS.SKILLS, []);

export const settingsStore = new TypedStorage<ExtensionSettings>(
  STORAGE_KEYS.SETTINGS,
  DEFAULT_SETTINGS
);

export const sessionsStore = new TypedStorage<Record<string, AgentSession>>(
  STORAGE_KEYS.SESSIONS,
  {}
);

export const activeSessionIdStore = new TypedStorage<string | null>(
  STORAGE_KEYS.ACTIVE_SESSION_ID,
  null
);

export const languageStore = new TypedStorage<'en' | 'hi'>(
  STORAGE_KEYS.LANGUAGE,
  'en'
);

export const practiceRunsStore = new TypedStorage<PracticeRun[]>(
  STORAGE_KEYS.PRACTICE_RUNS,
  []
);
