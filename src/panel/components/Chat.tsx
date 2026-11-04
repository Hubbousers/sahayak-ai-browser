import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { ErrorBanner } from './ErrorBanner';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  sourceNote?: string;
}

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  error?: { code: string; message: string } | null;
  onRetryLast?: () => void;
  onClearError?: () => void;
  onOpenSettings?: () => void;
}

export const Chat: React.FC<ChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  error,
  onRetryLast,
  onClearError,
  onOpenSettings
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '420px',
        gap: '12px'
      }}
    >
      {/* Error banner if active */}
      {error && (
        <ErrorBanner
          code={error.code}
          message={error.message}
          onRetry={onRetryLast}
          onDismiss={onClearError}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* Messages list */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px 16px',
              gap: '12px',
              color: '#94a3b8'
            }}
          >
            <div
              style={{
                backgroundColor: '#1e293b',
                padding: '12px',
                borderRadius: '50%',
                color: '#60a5fa'
              }}
            >
              <Sparkles size={24} />
            </div>
            <div>
              <p style={{ fontWeight: 600, color: '#f8fafc', margin: 0, fontSize: '13px' }}>
                Ask Sahayak
              </p>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', maxWidth: '240px' }}>
                Type a query or right-click any selected text on the page and choose "Sahayak — Explain this".
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%'
              }}
            >
              {msg.sender === 'assistant' && (
                <div
                  style={{
                    backgroundColor: '#2563eb',
                    borderRadius: '50%',
                    padding: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    flexShrink: 0
                  }}
                >
                  <Bot size={13} color="#ffffff" />
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius:
                      msg.sender === 'user'
                        ? '12px 12px 2px 12px'
                        : '12px 12px 12px 2px',
                    backgroundColor:
                      msg.sender === 'user' ? '#1d4ed8' : '#1e293b',
                    border:
                      msg.sender === 'user'
                        ? '1px solid #2563eb'
                        : '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {msg.text}
                </div>

                {msg.sourceNote && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#94a3b8',
                      alignSelf:
                        msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      fontStyle: 'italic'
                    }}
                  >
                    {msg.sourceNote}
                  </span>
                )}
              </div>

              {msg.sender === 'user' && (
                <div
                  style={{
                    backgroundColor: '#475569',
                    borderRadius: '50%',
                    padding: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    flexShrink: 0
                  }}
                >
                  <User size={13} color="#ffffff" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              width: 'fit-content',
              color: '#93c5fd',
              fontSize: '12px'
            }}
          >
            <Loader2 size={14} className="animate-spin" />
            <span>Sahayak is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '6px 10px'
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask a question..."
          disabled={isLoading}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            color: '#f8fafc',
            fontSize: '12px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          style={{
            backgroundColor: inputText.trim() && !isLoading ? '#2563eb' : '#334155',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: inputText.trim() && !isLoading ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  );
};
