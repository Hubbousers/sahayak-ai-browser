import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Bot, Sparkles, Eye, Zap, User, FileText } from 'lucide-react';
import { TabNavigator, TabKey } from './components/TabNavigator';
import { SettingsPanel } from './components/SettingsPanel';
import { Chat, ChatMessage } from './components/Chat';
import { SummarizePanel, SummaryMode } from './components/SummarizePanel';
import { VisualPanel } from './components/VisualPanel';
import { AgentPanel } from './components/AgentPanel';
import { SkillsPanel } from './components/SkillsPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { BgToPanel, StructuredSummary, YouTubeSummary } from '@shared/types';
import { settingsStore, languageStore } from '@shared/storage';
import { generateText } from '@shared/model/orchestrate';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('summarize');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<{ code: string; message: string } | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  // Summarize state (Article + YouTube)
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('article');
  const [summary, setSummary] = useState<StructuredSummary | null>(null);
  const [youtubeSummary, setYoutubeSummary] = useState<YouTubeSummary | null>(null);
  const [articleTitle, setArticleTitle] = useState<string | undefined>(undefined);
  const [siteName, setSiteName] = useState<string | undefined>(undefined);
  const [summaryLanguage, setSummaryLanguage] = useState<'en' | 'hi'>('en');
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    // Load initial language preference
    languageStore.get().then((lang) => {
      if (lang) setSummaryLanguage(lang);
    });

    // Check active tab URL on open to automatically switch to YouTube mode if on YouTube
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeUrl = tabs[0]?.url || '';
        if (activeUrl.includes('youtube.com/watch') || activeUrl.includes('youtu.be/')) {
          setSummaryMode('youtube');
        }
      });
    }

    // Notify background worker that side panel is initialized
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'init' }, (res) => {
        console.log('Sahayak initialized response from background:', res);
      });

      // Listen for messages from background
      const messageListener = (message: BgToPanel) => {
        if (message.type === 'contextActionResult') {
          setActiveTab('chat');
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              sender: 'assistant',
              text: message.output,
              timestamp: Date.now(),
              sourceNote: `Result for right-click: ${message.action}`
            }
          ]);
        } else if (message.type === 'articleSummary') {
          setSummary(message.summary);
          setSummaryLanguage(message.language);
          setIsSummarizing(false);
        } else if (message.type === 'youtubeSummary') {
          setYoutubeSummary(message.summary);
          setSummaryLanguage(message.language);
          setIsSummarizing(false);
        } else if (message.type === 'error') {
          if (activeTab === 'summarize') {
            setSummaryError({ code: message.code, message: message.message });
          } else {
            setChatError({ code: message.code, message: message.message });
          }
        } else if (message.type === 'apiRetry') {
          setRetryNotice(`Rate limit reached. Retrying (Attempt ${message.attempt}) in ${message.retryAfterSecs}s...`);
          setTimeout(() => setRetryNotice(null), 3000);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, [activeTab]);

  useEffect(() => {
    // Listen for tab focus changes to update active page reference
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onActivated) {
      const tabListener = async (activeInfo: chrome.tabs.TabActiveInfo) => {
        // When user switches tabs, reset active summary and errors so panel reflects the newly active page
        setSummary(null);
        setYoutubeSummary(null);
        setArticleTitle(undefined);
        setSiteName(undefined);
        setSummaryError(null);
        setIsSummarizing(false);

        try {
          const tab = await chrome.tabs.get(activeInfo.tabId);
          if (tab.url?.includes('youtube.com/watch') || tab.url?.includes('youtu.be/')) {
            setSummaryMode('youtube');
          } else {
            setSummaryMode('article');
          }
        } catch {
          // Ignore
        }
      };

      chrome.tabs.onActivated.addListener(tabListener);
      return () => {
        chrome.tabs.onActivated.removeListener(tabListener);
      };
    }
  }, []);

  const handleRequestSummary = () => {
    setSummaryError(null);
    setIsSummarizing(true);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // Timeout guard: if background doesn't respond within 20s, fail gracefully
      const timeoutId = setTimeout(() => {
        setIsSummarizing((current) => {
          if (current) {
            setSummaryError({
              code: 'ERR_TIMEOUT',
              message: 'Summary request timed out. Please ensure you are on a standard webpage and try again.'
            });
            return false;
          }
          return current;
        });
      }, 20000);

      chrome.runtime.sendMessage({ type: 'requestSummary' }, (response) => {
        clearTimeout(timeoutId);
        setIsSummarizing(false);
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          setSummaryError({
            code: 'ERR_RUNTIME',
            message: lastError.message || 'Error communicating with background worker.'
          });
          return;
        }

        if (response && response.ok) {
          setSummary(response.summary);
          setArticleTitle(response.articleTitle);
          setSiteName(response.siteName);
        } else if (response?.error) {
          setSummaryError(response.error);
        } else {
          setSummaryError({
            code: 'ERR_UNKNOWN',
            message: 'Failed to generate summary from active page.'
          });
        }
      });
    } else {
      // Mock for local dev
      setTimeout(() => {
        setIsSummarizing(false);
        setSummary({
          tldr: 'This article outlines key architectural principles and implementation steps.',
          keyPoints: [
            'Local-only privacy model with human in the loop',
            'Readability.js for article distraction elimination',
            'Structured deterministic JSON output verified with Zod schemas',
            'Dual language support in English and Hinglish',
            'Resilient retry with exponential backoff on rate limits'
          ],
          actions: [
            'Review proposed action items before approval',
            'Configure default language preference in Settings',
            'Test on complex multi-paragraph articles'
          ]
        });
        setArticleTitle('Sample Article Preview');
      }, 1000);
    }
  };

  const handleRequestYouTubeSummary = (url: string) => {
    setSummaryError(null);
    setIsSummarizing(true);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      const timeoutId = setTimeout(() => {
        setIsSummarizing((current) => {
          if (current) {
            setSummaryError({
              code: 'ERR_TIMEOUT',
              message: 'YouTube summary request timed out. Please check your network connection and try again.'
            });
            return false;
          }
          return current;
        });
      }, 25000);

      chrome.runtime.sendMessage({ type: 'requestYouTubeSummary', url }, (response) => {
        clearTimeout(timeoutId);
        setIsSummarizing(false);
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          setSummaryError({
            code: 'ERR_RUNTIME',
            message: lastError.message || 'Error communicating with background worker.'
          });
          return;
        }

        if (response && response.ok) {
          setYoutubeSummary(response.summary);
        } else if (response?.error) {
          setSummaryError(response.error);
        } else {
          setSummaryError({
            code: 'ERR_UNKNOWN',
            message: 'Failed to generate summary from YouTube video.'
          });
        }
      });
    } else {
      setTimeout(() => {
        setIsSummarizing(false);
        setYoutubeSummary({
          videoId: 'mock123',
          title: 'Mock Public YouTube Video Preview',
          tldr: 'This video introduces key concepts of browser AI extensions.',
          keyPoints: [
            'How manifest V3 extensions operate with side panels',
            'Safe local execution and transcript parsing',
            'Clickable chapter timestamp generation'
          ],
          chapters: [
            { label: 'Introduction to Sahayak', seconds: 0, snippet: 'Overview' },
            { label: 'Core Architecture', seconds: 45, snippet: 'Side panel discussion' },
            { label: 'Demonstration', seconds: 120, snippet: 'Real-time test' }
          ],
          actions: ['Test timestamp links', 'Try Hindi translation']
        });
      }, 1000);
    }
  };

  const handleToggleSummaryLanguage = (lang: 'en' | 'hi') => {
    setSummaryLanguage(lang);
    languageStore.set(lang);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'toggleLanguage', lang });
    }

    // Auto-regenerate active summary in chosen language
    if (summaryMode === 'article' && summary) {
      setTimeout(() => handleRequestSummary(), 100);
    } else if (summaryMode === 'youtube' && youtubeSummary) {
      setTimeout(
        () => handleRequestYouTubeSummary(`https://www.youtube.com/watch?v=${youtubeSummary.videoId}`),
        100
      );
    }
  };

  const handleSendMessage = async (text: string) => {
    setChatError(null);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: Date.now()
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const settings = await settingsStore.get();
      const apiKey = settings?.apiKey || '';

      if (!apiKey) {
        setChatError({
          code: 'ERR_NO_API_KEY',
          message: 'No Gemini API key configured. Please enter your key in Settings.'
        });
        setIsLoading(false);
        return;
      }

      // Check if background worker message passing is available
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(
          { type: 'chatSend', message: text, mode: 'page' },
          (response) => {
            setIsLoading(false);
            if (response && response.ok) {
              setMessages((prev) => [
                ...prev,
                {
                  id: (Date.now() + 1).toString(),
                  sender: 'assistant',
                  text: response.text,
                  timestamp: Date.now(),
                  sourceNote: response.model ? `Model: ${response.model}` : undefined
                }
              ]);
            } else {
              const err = response?.error || {
                code: 'ERR_API_ERROR',
                message: 'Failed to receive a response from the AI assistant.'
              };
              setChatError(err);
            }
          }
        );
      } else {
        // Fallback directly via orchestrator for dev preview / mock testing
        const languageInstruction =
          settings?.preferredLanguage === 'hi'
            ? 'Respond in Hinglish (Hindi written in Roman script, natural mix with English terms).'
            : 'Respond in clear, natural English.';

        const result = await generateText({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are Sahayak, an AI browser assistant. ${languageInstruction}\n\nUser Question:\n${text}`
                }
              ]
            }
          ],
          intent: { kind: 'chat' },
          apiKey,
          groqApiKey: settings?.groqApiKey,
          preferredTier: settings?.modelTier,
          onRetry: (attempt, delaySec) => {
            setRetryNotice(`Rate limit reached. Retrying (Attempt ${attempt}) in ${delaySec}s...`);
            setTimeout(() => setRetryNotice(null), 3500);
          }
        });

        setIsLoading(false);
        if (result.success) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: 'assistant',
              text: result.text,
              timestamp: Date.now(),
              sourceNote: `Model: ${result.model}`
            }
          ]);
        } else if (result.error) {
          setChatError(result.error);
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setChatError({
        code: 'ERR_UNKNOWN',
        message: err?.message || 'An unexpected error occurred while communicating with the model.'
      });
    }
  };

  const handleRetryLast = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.sender === 'user');
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.text);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            error={chatError}
            onRetryLast={handleRetryLast}
            onClearError={() => setChatError(null)}
            onOpenSettings={() => setActiveTab('settings')}
          />
        );

      case 'settings':
        return <SettingsPanel />;

      case 'summarize':
        return (
          <SummarizePanel
            mode={summaryMode}
            onSelectMode={setSummaryMode}
            summary={summary}
            youtubeSummary={youtubeSummary}
            articleTitle={articleTitle}
            siteName={siteName}
            language={summaryLanguage}
            isLoading={isSummarizing}
            error={summaryError}
            onRequestSummary={handleRequestSummary}
            onRequestYouTubeSummary={handleRequestYouTubeSummary}
            onToggleLanguage={handleToggleSummaryLanguage}
            onClearError={() => setSummaryError(null)}
            onOpenSettings={() => setActiveTab('settings')}
          />
        );

      case 'visual':
        return <VisualPanel />;

      case 'agent':
        return <AgentPanel />;

      case 'skills':
        return <SkillsPanel />;

      case 'profile':
        return <ProfilePanel />;

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#111827',
          borderBottom: '1px solid #1f2937'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              backgroundColor: '#2563eb',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Bot size={20} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Sahayak</h1>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
              AI Browser Assistant
            </p>
          </div>
        </div>
        <div
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '9999px',
            backgroundColor: '#1e293b',
            color: '#10b981',
            border: '1px solid #334155',
            fontWeight: 500
          }}
        >
          Phase 4 Active
        </div>
      </header>

      {/* Tabs */}
      <TabNavigator activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Retry notification banner */}
      {retryNotice && (
        <div
          style={{
            margin: '10px 16px 0 16px',
            padding: '8px 12px',
            backgroundColor: '#854d0e',
            border: '1px solid #ca8a04',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#fef08a'
          }}
        >
          <Sparkles size={13} style={{ marginRight: '6px', display: 'inline' }} />
          <span>{retryNotice}</span>
        </div>
      )}

      {/* Main Container */}
      <main
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto'
        }}
      >
        {renderTabContent()}
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '10px 16px',
          backgroundColor: '#111827',
          borderTop: '1px solid #1f2937',
          fontSize: '11px',
          color: '#64748b',
          textAlign: 'center'
        }}
      >
        Sahayak • Gemini Flash-Lite Active
      </footer>
    </div>
  );
};

const placeholderCardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '10px',
  padding: '24px 16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '12px'
};

const placeholderIconWrapperStyle = (bgColor: string): React.CSSProperties => ({
  backgroundColor: bgColor,
  borderRadius: '12px',
  padding: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
});

const placeholderTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: '#f8fafc',
  margin: 0
};

const placeholderTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  maxWidth: '280px',
  lineHeight: '1.5',
  margin: 0
};

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
