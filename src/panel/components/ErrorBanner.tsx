import React from 'react';
import { AlertCircle, RefreshCw, Key, X } from 'lucide-react';

interface ErrorBannerProps {
  code: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  onOpenSettings?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  code,
  message,
  onRetry,
  onDismiss,
  onOpenSettings
}) => {
  const isKeyError = code === 'ERR_NO_API_KEY' || message.toLowerCase().includes('api key');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: '#450a0a',
        border: '1px solid #991b1b',
        color: '#fecaca',
        fontSize: '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#f87171' }}>
          <AlertCircle size={16} />
          <span>{code}</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: '#fca5a5',
              cursor: 'pointer',
              padding: '2px'
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <p style={{ margin: 0, color: '#fca5a5', lineHeight: 1.4 }}>{message}</p>

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              backgroundColor: '#991b1b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        )}

        {isKeyError && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Key size={12} />
            <span>Open Settings</span>
          </button>
        )}
      </div>
    </div>
  );
};
