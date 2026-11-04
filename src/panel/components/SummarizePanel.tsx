import React, { useState } from 'react';
import {
  FileText,
  Video,
  Sparkles,
  CheckCircle2,
  Globe,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Play
} from 'lucide-react';
import { StructuredSummary, YouTubeSummary } from '@shared/types';
import { ErrorBanner } from './ErrorBanner';

export type SummaryMode = 'article' | 'youtube';

interface SummarizePanelProps {
  mode: SummaryMode;
  onSelectMode: (mode: SummaryMode) => void;
  summary: StructuredSummary | null;
  youtubeSummary: YouTubeSummary | null;
  articleTitle?: string;
  siteName?: string;
  language: 'en' | 'hi';
  isLoading: boolean;
  error?: { code: string; message: string } | null;
  onRequestSummary: () => void;
  onRequestYouTubeSummary: (url: string) => void;
  onToggleLanguage: (lang: 'en' | 'hi') => void;
  onClearError?: () => void;
  onOpenSettings?: () => void;
}

export const SummarizePanel: React.FC<SummarizePanelProps> = ({
  mode,
  onSelectMode,
  summary,
  youtubeSummary,
  articleTitle,
  siteName,
  language,
  isLoading,
  error,
  onRequestSummary,
  onRequestYouTubeSummary,
  onToggleLanguage,
  onClearError,
  onOpenSettings
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [youtubeInputUrl, setYoutubeInputUrl] = useState<string>('');

  const handleCopySummary = () => {
    let textToCopy = '';
    if (mode === 'youtube' && youtubeSummary) {
      const chapterText = youtubeSummary.chapters.length
        ? '\n\nChapters:\n' +
          youtubeSummary.chapters
            .map((c) => `[${formatTime(c.seconds)}] ${c.label} ${c.snippet ? `(${c.snippet})` : ''}`)
            .join('\n')
        : '';
      textToCopy = `Video: ${youtubeSummary.title}\n\nTL;DR:\n${youtubeSummary.tldr}\n\nKey Insights:\n${youtubeSummary.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}${chapterText}\n\nActions:\n${youtubeSummary.actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
    } else if (summary) {
      textToCopy = `TL;DR:\n${summary.tldr}\n\nKey Insights:\n${summary.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nActionable Takeaways:\n${(summary.actions || summary.nextSteps || []).map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleYouTubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeInputUrl.trim() || isLoading) return;
    onRequestYouTubeSummary(youtubeInputUrl.trim());
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleJumpToTimestamp = (seconds: number) => {
    if (!youtubeSummary) return;
    const targetUrl = `https://www.youtube.com/watch?v=${youtubeSummary.videoId}&t=${seconds}s`;

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: targetUrl });
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Mode Switch Tabs (Article vs YouTube) */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          padding: '3px',
          border: '1px solid #334155'
        }}
      >
        <button
          onClick={() => onSelectMode('article')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: mode === 'article' ? '#2563eb' : 'transparent',
            color: mode === 'article' ? '#ffffff' : '#94a3b8',
            fontSize: '12px',
            fontWeight: mode === 'article' ? 600 : 500,
            cursor: 'pointer'
          }}
        >
          <FileText size={14} />
          <span>Web Article</span>
        </button>

        <button
          onClick={() => onSelectMode('youtube')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: mode === 'youtube' ? '#dc2626' : 'transparent',
            color: mode === 'youtube' ? '#ffffff' : '#94a3b8',
            fontSize: '12px',
            fontWeight: mode === 'youtube' ? 600 : 500,
            cursor: 'pointer'
          }}
        >
          <Video size={14} />
          <span>YouTube Video</span>
        </button>
      </div>

      {/* Action and Language Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        {/* Language switch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#1e293b',
            padding: '3px',
            borderRadius: '6px',
            border: '1px solid #334155'
          }}
        >
          <button
            onClick={() => onToggleLanguage('en')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: language === 'en' ? '#2563eb' : 'transparent',
              color: language === 'en' ? '#ffffff' : '#94a3b8',
              fontSize: '11px',
              fontWeight: language === 'en' ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            <Globe size={11} />
            <span>English</span>
          </button>
          <button
            onClick={() => onToggleLanguage('hi')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: language === 'hi' ? '#2563eb' : 'transparent',
              color: language === 'hi' ? '#ffffff' : '#94a3b8',
              fontSize: '11px',
              fontWeight: language === 'hi' ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            <span>Hinglish</span>
          </button>
        </div>

        {/* Trigger button for Article Mode */}
        {mode === 'article' && (
          <button
            onClick={onRequestSummary}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            <span>{summary ? 'Refresh Summary' : 'Summarize Page'}</span>
          </button>
        )}
      </div>

      {/* YouTube URL input for YouTube Mode */}
      {mode === 'youtube' && (
        <form onSubmit={handleYouTubeSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Paste public YouTube URL (https://youtube.com/watch?v=...)"
            value={youtubeInputUrl}
            onChange={(e) => setYoutubeInputUrl(e.target.value)}
            disabled={isLoading}
            style={{
              flex: 1,
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 10px',
              color: '#f8fafc',
              fontSize: '12px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={!youtubeInputUrl.trim() || isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: youtubeInputUrl.trim() && !isLoading ? 'pointer' : 'default',
              opacity: youtubeInputUrl.trim() && !isLoading ? 1 : 0.6
            }}
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            <span>Summarize</span>
          </button>
        </form>
      )}

      {/* Error state */}
      {error && (
        <ErrorBanner
          code={error.code}
          message={error.message}
          onRetry={mode === 'article' ? onRequestSummary : () => onRequestYouTubeSummary(youtubeInputUrl)}
          onDismiss={onClearError}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '36px 16px',
            backgroundColor: '#1e293b',
            borderRadius: '10px',
            border: '1px solid #334155',
            gap: '12px',
            textAlign: 'center'
          }}
        >
          <Loader2 size={28} color="#3b82f6" className="animate-spin" />
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
              {mode === 'youtube'
                ? 'Fetching transcript & generating chapter summary...'
                : 'Extracting clean content & generating summary...'}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
              {mode === 'youtube'
                ? 'Mapping timestamps to clickable chapter anchors'
                : 'Excluding navigation, sidebars, and ads via Readability.js'}
            </p>
          </div>
        </div>
      )}

      {/* Empty State for Article */}
      {mode === 'article' && !summary && !isLoading && !error && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '36px 16px',
            backgroundColor: '#1e293b',
            borderRadius: '10px',
            border: '1px solid #334155',
            gap: '12px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              borderRadius: '50%',
              padding: '12px',
              color: '#3b82f6',
              border: '1px solid #334155'
            }}
          >
            <FileText size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              No Article Summary Yet
            </h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0', maxWidth: '280px' }}>
              Click <strong>Summarize Page</strong> above to extract this article, news story, or blog post.
            </p>
          </div>
        </div>
      )}

      {/* Empty State for YouTube */}
      {mode === 'youtube' && !youtubeSummary && !isLoading && !error && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '36px 16px',
            backgroundColor: '#1e293b',
            borderRadius: '10px',
            border: '1px solid #334155',
            gap: '12px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              borderRadius: '50%',
              padding: '12px',
              color: '#ef4444',
              border: '1px solid #334155'
            }}
          >
            <Video size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Public YouTube Video Summarizer
            </h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0', maxWidth: '280px' }}>
              Paste a public YouTube link above or open any YouTube video in Chrome to generate chapter breakdowns and timestamp links.
            </p>
          </div>
        </div>
      )}

      {/* Render Article Summary Content */}
      {mode === 'article' && summary && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {articleTitle && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                fontSize: '11px',
                color: '#94a3b8'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <ExternalLink size={12} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    color: '#e2e8f0',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={articleTitle}
                >
                  {articleTitle}
                </span>
                {siteName && <span>({siteName})</span>}
              </div>
              <button
                onClick={handleCopySummary}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: copied ? '#34d399' : '#94a3b8',
                  fontSize: '11px',
                  cursor: 'pointer',
                  marginLeft: '8px'
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}

          {/* Section 1: TL;DR */}
          <div
            style={{
              padding: '14px',
              backgroundColor: '#1e293b',
              border: '1px solid #3b82f6',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa' }}>
              <Sparkles size={15} />
              <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TL;DR
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#f8fafc', fontWeight: 500, lineHeight: 1.5 }}>
              {summary.tldr}
            </p>
          </div>

          {/* Section 2: 5 Key Points */}
          <div
            style={{
              padding: '14px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <strong style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Key Insights
            </strong>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {summary.keyPoints.map((point, idx) => (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#e2e8f0',
                    lineHeight: 1.5
                  }}
                >
                  <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 3: Next Steps */}
          {(summary.actions || summary.nextSteps) && (summary.actions || summary.nextSteps)!.length > 0 && (
            <div
              style={{
                padding: '14px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <strong style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                What To Do Next
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(summary.actions || summary.nextSteps)!.map((action, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '12px',
                      color: '#e2e8f0',
                      lineHeight: 1.5
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#3b82f6',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 700,
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      {idx + 1}
                    </div>
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render YouTube Summary Content */}
      {mode === 'youtube' && youtubeSummary && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Video Title Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              fontSize: '11px',
              color: '#94a3b8'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <Video size={13} color="#ef4444" style={{ flexShrink: 0 }} />
              <span
                style={{
                  color: '#e2e8f0',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={youtubeSummary.title}
              >
                {youtubeSummary.title}
              </span>
            </div>
            <button
              onClick={handleCopySummary}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: copied ? '#34d399' : '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer',
                marginLeft: '8px'
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Section 1: TL;DR */}
          <div
            style={{
              padding: '14px',
              backgroundColor: '#1e293b',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
              <Sparkles size={15} />
              <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Video TL;DR
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#f8fafc', fontWeight: 500, lineHeight: 1.5 }}>
              {youtubeSummary.tldr}
            </p>
          </div>

          {/* Section 2: Timestamped Chapters */}
          {youtubeSummary.chapters && youtubeSummary.chapters.length > 0 ? (
            <div
              style={{
                padding: '14px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
                <Clock size={15} />
                <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Chapters & Timestamps
                </strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {youtubeSummary.chapters.map((ch, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleJumpToTimestamp(ch.seconds)}
                    title={`Jump to ${formatTime(ch.seconds)} on YouTube`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      fontSize: '12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          backgroundColor: '#1e3a8a',
                          color: '#60a5fa',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {formatTime(ch.seconds)}
                      </span>
                      <span style={{ fontWeight: 500 }}>{ch.label}</span>
                    </div>
                    {ch.snippet && (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                        {ch.snippet}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                fontSize: '11px',
                color: '#94a3b8'
              }}
            >
              No timestamp chapters available for this video transcript.
            </div>
          )}

          {/* Section 3: Key Points */}
          <div
            style={{
              padding: '14px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <strong style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Key Concepts & Discussion Points
            </strong>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {youtubeSummary.keyPoints.map((point, idx) => (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#e2e8f0',
                    lineHeight: 1.5
                  }}
                >
                  <CheckCircle2 size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 4: Action Items */}
          {youtubeSummary.actions && youtubeSummary.actions.length > 0 && (
            <div
              style={{
                padding: '14px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <strong style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Key Takeaways
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {youtubeSummary.actions.map((act, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '12px',
                      color: '#e2e8f0',
                      lineHeight: 1.5
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 700,
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      {idx + 1}
                    </div>
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
