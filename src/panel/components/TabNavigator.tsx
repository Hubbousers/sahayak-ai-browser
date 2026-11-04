import React from 'react';
import {
  FileText,
  MessageSquare,
  Eye,
  Bot,
  Zap,
  User,
  Settings
} from 'lucide-react';

export type TabKey =
  | 'summarize'
  | 'chat'
  | 'visual'
  | 'agent'
  | 'skills'
  | 'profile'
  | 'settings';

interface TabItem {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

interface TabNavigatorProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
}

export const TabNavigator: React.FC<TabNavigatorProps> = ({
  activeTab,
  onSelectTab
}) => {
  const tabs: TabItem[] = [
    { key: 'summarize', label: 'Summary', icon: <FileText size={15} /> },
    { key: 'chat', label: 'Chat', icon: <MessageSquare size={15} /> },
    { key: 'visual', label: 'Visual', icon: <Eye size={15} /> },
    { key: 'agent', label: 'Agent', icon: <Bot size={15} /> },
    { key: 'skills', label: 'Skills', icon: <Zap size={15} /> },
    { key: 'profile', label: 'Profile', icon: <User size={15} /> },
    { key: 'settings', label: 'Settings', icon: <Settings size={15} /> }
  ];

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 8px',
        backgroundColor: '#111827',
        borderBottom: '1px solid #1f2937',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelectTab(tab.key)}
            title={tab.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              backgroundColor: isActive ? '#2563eb' : 'transparent',
              color: isActive ? '#ffffff' : '#9ca3af',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
