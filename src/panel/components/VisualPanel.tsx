import React, { useState, useEffect } from 'react';
import { Camera, Loader2, AlertCircle, Eye, MessageSquare, Trash2 } from 'lucide-react';

export const VisualPanel: React.FC = () => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  // Listen for screenshotAnalysis message from background
  useEffect(() => {
    const listener = (message: any) => {
      if (message?.type === 'screenshotAnalysis' && message?.answer) {
        // The background sends either a dataURL (the screenshot) or analysis text
        const answer: string = message.answer;
        if (answer.startsWith('data:image/')) {
          // It's a raw screenshot data URL
          setScreenshot(answer);
          setLoading(false);
          setError(null);
        } else {
          // It's a text analysis result
          setAnalysisResult(answer);
          setAnalysing(false);
        }
      } else if (message?.type === 'error') {
        setError(message.message || 'An error occurred.');
        setLoading(false);
        setAnalysing(false);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(listener);
    }
    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(listener);
      }
    };
  }, []);

  const handleCapture = () => {
    setLoading(true);
    setError(null);
    setScreenshot(null);
    setAnalysisResult(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'screenshotCapture' }, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          setError(lastError.message || 'Failed to capture screenshot.');
          setLoading(false);
        } else if (response && !response.ok) {
          setError(response.error?.message || 'Failed to capture screenshot.');
          setLoading(false);
        }
        // On success, the panel receives screenshotAnalysis from sendToPanel in bg
      });
    } else {
      // Dev mock
      setTimeout(() => {
        setScreenshot('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        setLoading(false);
      }, 1000);
    }
  };

  const handleAskQuestion = () => {
    if (!question.trim() || !screenshot) return;
    setAnalysing(true);
    setAnalysisResult(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: 'screenshotAnalyse', question: question.trim(), dataUrl: screenshot },
        (response) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            setError(lastError.message || 'Analysis failed.');
            setAnalysing(false);
          } else if (response?.ok && response?.text) {
            setAnalysisResult(response.text);
            setAnalysing(false);
          } else if (response?.error) {
            setError(response.error.message || 'Analysis failed.');
            setAnalysing(false);
          }
        }
      );
    } else {
      setTimeout(() => {
        setAnalysisResult('This is a mock analysis result. The page shows a web interface.');
        setAnalysing(false);
      }, 1000);
    }
  };

  const handleClear = () => {
    setScreenshot(null);
    setAnalysisResult(null);
    setError(null);
    setQuestion('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            backgroundColor: '#7c3aed',
            borderRadius: '8px',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Eye size={16} color="#ffffff" />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Visual Analysis</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Capture the current tab and ask questions about it</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="btn-capture-screenshot"
            onClick={handleCapture}
            disabled={loading}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: loading ? '#334155' : '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'background-color 0.2s ease'
            }}
          >
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={14} />}
            {loading ? 'Capturing…' : 'Capture Screenshot'}
          </button>

          {screenshot && (
            <button
              id="btn-clear-screenshot"
              onClick={handleClear}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor: '#334155',
                color: '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'background-color 0.2s ease'
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          backgroundColor: '#1f0a0a',
          border: '1px solid #7f1d1d',
          borderRadius: '8px',
          padding: '12px',
          color: '#fca5a5',
          fontSize: '12px'
        }}>
          <AlertCircle size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Screenshot Preview */}
      {screenshot && (
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '10px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Camera size={12} color="#7c3aed" />
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Captured Screenshot</span>
          </div>
          <img
            src={screenshot}
            alt="Page screenshot"
            style={{
              width: '100%',
              display: 'block',
              maxHeight: '220px',
              objectFit: 'contain',
              backgroundColor: '#0f172a'
            }}
          />
        </div>
      )}

      {/* Ask Question About Screenshot */}
      {screenshot && (
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageSquare size={13} color="#60a5fa" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Ask about this screenshot</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="screenshot-question-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              placeholder="What does this page show? Describe the error…"
              disabled={analysing}
              style={{
                flex: 1,
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '12px',
                padding: '8px 10px',
                outline: 'none'
              }}
            />
            <button
              id="btn-analyse-screenshot"
              onClick={handleAskQuestion}
              disabled={!question.trim() || analysing}
              style={{
                backgroundColor: question.trim() && !analysing ? '#2563eb' : '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 12px',
                cursor: question.trim() && !analysing ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'background-color 0.2s ease'
              }}
            >
              {analysing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Ask'}
            </button>
          </div>
        </div>
      )}

      {/* Analysis Result */}
      {analysisResult && (
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #1d4ed8',
          borderRadius: '10px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={12} color="#60a5fa" />
            <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600 }}>Visual Analysis Result</span>
          </div>
          <p style={{
            fontSize: '12px',
            color: '#e2e8f0',
            margin: 0,
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {analysisResult}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!screenshot && !loading && !error && (
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px dashed #334155',
          borderRadius: '10px',
          padding: '32px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          textAlign: 'center'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderRadius: '50%',
            padding: '14px',
            color: '#475569'
          }}>
            <Camera size={28} />
          </div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', margin: 0 }}>No screenshot yet</p>
          <p style={{ fontSize: '11px', color: '#475569', margin: 0, maxWidth: '220px', lineHeight: '1.5' }}>
            Click "Capture Screenshot" to take a snapshot of the current page, then ask questions about what you see.
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
