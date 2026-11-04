import React, { useState, useEffect } from 'react';
import {
  Key,
  Globe,
  Gauge,
  Cpu,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Save,
  Lock
} from 'lucide-react';
import { ExtensionSettings } from '@shared/types';
import { settingsStore, languageStore } from '@shared/storage';
import { DEFAULT_SETTINGS } from '@shared/constants';

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [showGroqKey, setShowGroqKey] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await settingsStore.get();
      if (saved) {
        setSettings(saved);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      // 1. Save locally via settingsStore wrapper
      await settingsStore.set(settings);
      await languageStore.set(settings.preferredLanguage);

      // 2. Also notify background service worker if chrome runtime is available
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'setSettings',
          settings
        });
      }

      setStatusMessage({
        text: 'Settings saved successfully! Data stored locally.',
        type: 'success'
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setStatusMessage({
        text: 'Failed to save settings. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleLanguageToggle = async (lang: 'en' | 'hi') => {
    const updated = { ...settings, preferredLanguage: lang };
    setSettings(updated);
    await settingsStore.set(updated);
    await languageStore.set(lang);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'toggleLanguage',
        lang
      });
    }

    setStatusMessage({
      text: `Language set to ${lang === 'en' ? 'English' : 'Hinglish (Hindi in Latin script)'}`,
      type: 'success'
    });
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleClearAllData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear all locally stored data (API keys, profile, skills, and sessions)? This cannot be undone.'
    );
    if (!confirmed) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'clearSession' });
      } else {
        localStorage.clear();
      }

      await settingsStore.set(DEFAULT_SETTINGS);
      await languageStore.set(DEFAULT_SETTINGS.preferredLanguage);
      setSettings(DEFAULT_SETTINGS);

      setStatusMessage({
        text: 'All local data and settings have been cleared.',
        type: 'success'
      });
    } catch (err) {
      setStatusMessage({
        text: 'Error clearing local data: ' + String(err),
        type: 'error'
      });
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
          Extension Settings
        </h2>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
          Configure API credentials, preferred language, and agent thresholds.
        </p>
      </div>

      {statusMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            backgroundColor: statusMessage.type === 'success' ? '#064e3b' : '#7f1d1d',
            color: statusMessage.type === 'success' ? '#6ee7b7' : '#fca5a5',
            border: `1px solid ${statusMessage.type === 'success' ? '#059669' : '#b91c1c'}`
          }}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Gemini API Key */}
        <div
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label
              htmlFor="api-key-input"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Key size={15} color="#60a5fa" />
              Google Gemini API Key
            </label>
            {settings.apiKey && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#064e3b',
                  color: '#6ee7b7',
                  border: '1px solid #059669',
                  fontWeight: 600
                }}
              >
                Active
              </span>
            )}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="api-key-input"
              type={showKey ? 'text' : 'password'}
              placeholder="AIzaSy..."
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '8px 70px 8px 10px',
                fontSize: '12px',
                color: '#f8fafc',
                outline: 'none',
                fontFamily: 'monospace'
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: '8px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '2px 6px'
              }}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
            <Lock size={12} />
            <span>Stored strictly locally in chrome.storage.local. Never sent to third parties.</span>
          </div>
        </div>

        {/* Groq API Key (Fallback) */}
        <div
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label
              htmlFor="groq-api-key-input"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Key size={15} color="#f59e0b" />
              Groq API Key (Fallback, Optional)
            </label>
            {settings.groqApiKey && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#064e3b',
                  color: '#6ee7b7',
                  border: '1px solid #059669',
                  fontWeight: 600
                }}
              >
                Active
              </span>
            )}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="groq-api-key-input"
              type={showGroqKey ? 'text' : 'password'}
              placeholder="gsk_..."
              value={settings.groqApiKey || ''}
              onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value.trim() })}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '8px 70px 8px 10px',
                fontSize: '12px',
                color: '#f8fafc',
                outline: 'none',
                fontFamily: 'monospace'
              }}
            />
            <button
              type="button"
              onClick={() => setShowGroqKey(!showGroqKey)}
              style={{
                position: 'absolute',
                right: '8px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '2px 6px'
              }}
            >
              {showGroqKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
            <Lock size={12} />
            <span>Used automatically as a secondary text fallback if Gemini rate limits or errors.</span>
          </div>
        </div>

        {/* Language Selection */}
        <div
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <label
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe size={15} color="#34d399" />
            Response Language (English / Hinglish)
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleLanguageToggle('en')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                border: settings.preferredLanguage === 'en' ? '2px solid #3b82f6' : '1px solid #475569',
                backgroundColor: settings.preferredLanguage === 'en' ? '#1e3a8a' : '#0f172a',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: settings.preferredLanguage === 'en' ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageToggle('hi')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                border: settings.preferredLanguage === 'hi' ? '2px solid #3b82f6' : '1px solid #475569',
                backgroundColor: settings.preferredLanguage === 'hi' ? '#1e3a8a' : '#0f172a',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: settings.preferredLanguage === 'hi' ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              Hinglish (Hindi in Latin)
            </button>
          </div>
        </div>

        {/* Step Limit & Model Tier */}
        <div
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          {/* Step Limit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label
                htmlFor="step-limit"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Gauge size={15} color="#f59e0b" />
                Agent Step Limit
              </label>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>
                {settings.stepLimit} steps
              </span>
            </div>
            <input
              id="step-limit"
              type="range"
              min="5"
              max="30"
              step="1"
              value={settings.stepLimit}
              onChange={(e) =>
                setSettings({ ...settings, stepLimit: parseInt(e.target.value, 10) })
              }
              style={{ accentColor: '#f59e0b', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Maximum autonomous exploration steps permitted per agent task before requiring manual review.
            </span>
          </div>

          <div style={{ borderTop: '1px solid #334155', margin: '4px 0' }} />

          {/* Model Tier */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="model-tier"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Cpu size={15} color="#c084fc" />
              Default Model Tier
            </label>
            <select
              id="model-tier"
              value={settings.modelTier}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  modelTier: e.target.value as ExtensionSettings['modelTier']
                })
              }
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '12px',
                color: '#f8fafc',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="lite">Gemini Flash-Lite (Fast, default)</option>
              <option value="standard">Gemini Flash (Standard reasoning)</option>
              <option value="vision">Gemini Flash Vision (Visuals & images)</option>
              <option value="fallback">Groq Llama 3.1 8B (Text fallback)</option>
            </select>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease'
          }}
        >
          <Save size={16} />
          <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </form>

      {/* Danger Zone: Clear Data */}
      <div
        style={{
          marginTop: '10px',
          backgroundColor: 'rgba(127, 29, 29, 0.2)',
          border: '1px solid #7f1d1d',
          borderRadius: '8px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#fca5a5' }}>
          Data Reset
        </span>
        <p style={{ fontSize: '11px', color: '#f87171', margin: 0 }}>
          Remove all local keys, sessions, and stored profile configurations from your browser.
        </p>
        <button
          type="button"
          onClick={handleClearAllData}
          style={{
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: '#991b1b',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          <Trash2 size={14} />
          <span>Clear All Local Data</span>
        </button>
      </div>
    </div>
  );
};
