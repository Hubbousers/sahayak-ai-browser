import React, { useState, useEffect } from 'react';
import {
  Check,
  SkipForward,
  Square,
  Play,
  RotateCw,
  AlertTriangle,
  ShieldAlert,
  Download,
  Crosshair,
  Layers,
  Eye,
  EyeOff,
  Search,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Bot,
  FileText
} from 'lucide-react';
import { AgentSession, AgentStep, DetectedElement } from '@shared/types';
import { activeSessionIdStore, sessionsStore } from '@shared/storage';

interface FindResult {
  type: 'find';
  targetNumber: number | null;
  targetLabel?: string;
  reason: string;
}

export const AgentPanel: React.FC = () => {
  // --- Scanner & Find It State ---
  const [elements, setElements] = useState<DetectedElement[]>([]);
  const [badgesVisible, setBadgesVisible] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [findResult, setFindResult] = useState<FindResult | null>(null);

  // --- Agent Session State ---
  const [session, setSession] = useState<AgentSession | null>(null);
  const [goal, setGoal] = useState<string>('');
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isProcessingDecision, setIsProcessingDecision] = useState<boolean>(false);
  const [consequentialConfirmed, setConsequentialConfirmed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Restore active session on mount
  useEffect(() => {
    loadSavedSession();

    // Listen for background updates
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      const listener = (msg: any) => {
        if (msg.type === 'agentSessionLoaded') {
          setSession(msg.session);
        } else if (msg.type === 'agentNewProposal') {
          setSession((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              steps: [...prev.steps.filter((s) => s.id !== msg.step.id), msg.step],
              currentStepIndex: prev.steps.length
            };
          });
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

  const loadSavedSession = async () => {
    try {
      const activeId = await activeSessionIdStore.get();
      if (activeId) {
        const allSessions = await sessionsStore.get();
        if (allSessions && allSessions[activeId]) {
          setSession(allSessions[activeId]);
          setDryRun(allSessions[activeId].dryRunEnabled);
        }
      }
    } catch (err) {
      console.warn('Could not restore saved agent session:', err);
    }
  };

  // --- Scanner Controls ---
  const handleScanElements = () => {
    setIsScanning(true);
    setError(null);
    setFindResult(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'scanElements', showBadges: true }, (response) => {
        setIsScanning(false);
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          setError(lastErr.message || 'Error communicating with page. Please reload the tab.');
          return;
        }

        if (response && response.ok) {
          setElements(response.elements || []);
          setBadgesVisible(true);
        } else {
          setError(response?.error || 'Failed to scan page elements.');
        }
      });
    }
  };

  const handleToggleBadges = () => {
    const nextState = !badgesVisible;
    setBadgesVisible(nextState);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'toggleBadges', show: nextState });
    }
  };

  const handleHighlight = (num: number) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'highlightElement', targetNumber: num });
    }
  };

  const handleFindIt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsSearching(true);
    setError(null);
    setFindResult(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'findIt', question: question.trim() }, (response) => {
        setIsSearching(false);
        if (response && response.ok) {
          setFindResult(response.result);
          setBadgesVisible(true);
          chrome.runtime.sendMessage({ type: 'scanElements', showBadges: true }, (scanResp) => {
            if (scanResp?.ok) setElements(scanResp.elements || []);
          });
        } else {
          setError(response?.error?.message || response?.error || 'Find It failed to locate element.');
        }
      });
    }
  };

  // --- Autonomous Agent Lifecycle (Phases 11 & 12) ---
  const handleStartAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    setIsStarting(true);
    setError(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: 'agentStart', goal: goal.trim(), dryRun },
        (response) => {
          setIsStarting(false);
          if (response && response.ok) {
            setSession(response.session);
          } else {
            setError(response?.error || 'Failed to start agent.');
          }
        }
      );
    }
  };

  const handleDecision = (decision: 'approve' | 'skip' | 'stop') => {
    if (!session) return;
    setIsProcessingDecision(true);
    setError(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'agentDecide', decision }, (response) => {
        setIsProcessingDecision(false);
        setConsequentialConfirmed(false);
        if (response && response.ok) {
          if (response.session) setSession(response.session);
        } else {
          setError(response?.error || `Failed to execute ${decision}.`);
          if (response?.session) setSession(response.session);
        }
      });
    }
  };

  const handleStopAgent = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'agentStop' }, () => {
        setSession((prev) => (prev ? { ...prev, running: false } : null));
      });
    }
  };

  const handleExportLog = (format: 'json' | 'md') => {
    if (!session) return;

    let content = '';
    let mimeType = 'text/plain';
    let filename = `sahayak_agent_log_${session.id}.${format}`;

    if (format === 'json') {
      content = JSON.stringify(session, null, 2);
      mimeType = 'application/json';
    } else {
      content = `# Sahayak Agent Session Log\n\n- **Session ID:** ${session.id}\n- **Goal:** ${session.goal}\n- **Page:** ${session.title} (${session.url})\n- **Status:** ${session.completed ? 'Completed' : session.running ? 'Running' : 'Stopped'}\n- **Dry-run:** ${session.dryRunEnabled ? 'Enabled' : 'Disabled'}\n\n## Action Steps (${session.steps.length}/${session.stepLimit})\n\n`;
      session.steps.forEach((s, idx) => {
        content += `### Step ${idx + 1}: ${s.action.type.toUpperCase()}${s.action.targetNumber ? ` on Element #${s.action.targetNumber}` : ''}\n- **Reason:** ${s.reason}\n- **Phase:** ${s.phase}\n- **Decision:** ${s.decision || 'none'}\n- **Executed:** ${s.executed ? 'Yes' : 'No'}\n${s.errorMessage ? `- **Error:** ${s.errorMessage}\n` : ''}\n`;
      });
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingStep =
    session && session.running && session.steps.length > 0
      ? session.steps[session.steps.length - 1]
      : null;
  const isPendingApproval = pendingStep && pendingStep.phase === 'propose';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Browser Agent & Scanner
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Single-step approval agent with live DOM numbering and dry-run protection.
          </p>
        </div>

        {session && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => handleExportLog('json')}
              title="Export session log as JSON"
              style={{
                background: 'none',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#94a3b8',
                padding: '4px 6px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Download size={12} /> JSON
            </button>
            <button
              type="button"
              onClick={() => handleExportLog('md')}
              title="Export session log as Markdown"
              style={{
                background: 'none',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#94a3b8',
                padding: '4px 6px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <FileText size={12} /> MD
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: '#7f1d1d',
            border: '1px solid #b91c1c',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '12px'
          }}
        >
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Active Agent Session Box */}
      {session && session.running ? (
        <div
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {/* Goal & Step Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa' }}>
                ACTIVE AGENT GOAL
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
                {session.goal}
              </div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: '#0f172a',
                color: '#38bdf8',
                padding: '3px 8px',
                borderRadius: '9999px',
                border: '1px solid #0284c7'
              }}
            >
              Step {session.steps.length} / {session.stepLimit}
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#0f172a',
              borderRadius: '9999px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (session.steps.length / session.stepLimit) * 100)}%`,
                backgroundColor: '#3b82f6',
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          {/* Pending Step Proposal (Action Card) */}
          {isPendingApproval && pendingStep && (
            <div
              style={{
                backgroundColor: '#0f172a',
                border: pendingStep.action.requiresExtraConfirm ? '2px solid #ef4444' : '1px solid #334155',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Bot size={13} />
                  PROPOSED ACTION
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    backgroundColor: '#f59e0b',
                    color: '#000000',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}
                >
                  {pendingStep.action.type}
                  {pendingStep.action.targetNumber ? ` #${pendingStep.action.targetNumber}` : ''}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 500 }}>
                {pendingStep.reason}
              </div>

              {pendingStep.action.value && (
                <div
                  style={{
                    fontSize: '11px',
                    backgroundColor: '#1e293b',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    color: '#93c5fd'
                  }}
                >
                  <strong>Input Value:</strong> &ldquo;{pendingStep.action.value}&rdquo;
                </div>
              )}

              {/* Consequential action warning */}
              {pendingStep.action.requiresExtraConfirm && !consequentialConfirmed && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    backgroundColor: '#450a0a',
                    border: '1px solid #dc2626',
                    borderRadius: '6px',
                    color: '#fecaca',
                    fontSize: '11px'
                  }}
                >
                  <ShieldAlert size={16} color="#ef4444" />
                  <span>
                    <strong>Consequential action:</strong> This step will submit or confirm. Please verify before approving.
                  </span>
                </div>
              )}

              {/* Approval Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                {pendingStep.action.requiresExtraConfirm && !consequentialConfirmed ? (
                  <button
                    type="button"
                    onClick={() => setConsequentialConfirmed(true)}
                    style={{
                      flex: 1,
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Confirm & Proceed
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDecision('approve')}
                    disabled={isProcessingDecision}
                    style={{
                      flex: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={14} />
                    <span>{isProcessingDecision ? 'Executing...' : 'Approve Step'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDecision('skip')}
                  disabled={isProcessingDecision}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    backgroundColor: '#334155',
                    color: '#f1f5f9',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <SkipForward size={14} />
                  <span>Skip</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDecision('stop')}
                  disabled={isProcessingDecision}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    backgroundColor: '#7f1d1d',
                    color: '#fecaca',
                    border: '1px solid #991b1b',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Square size={13} />
                  <span>Stop</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Agent Start Form */
        <form
          onSubmit={handleStartAgent}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label
              htmlFor="agent-goal-input"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Bot size={15} color="#60a5fa" />
              Autonomous Agent Goal
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <span>Dry-run (Highlight only)</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="agent-goal-input"
              type="text"
              placeholder="e.g. Fill the application form using my profile and prepare submission"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '12px',
                color: '#f8fafc',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={isStarting || !goal.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isStarting || !goal.trim() ? 'not-allowed' : 'pointer',
                opacity: isStarting || !goal.trim() ? 0.6 : 1
              }}
            >
              <Play size={13} />
              <span>{isStarting ? 'Starting...' : 'Start'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Action Controls (Scanner & Badges) */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={handleScanElements}
          disabled={isScanning}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Layers size={14} />
          <span>{isScanning ? 'Scanning...' : 'Scan Elements'}</span>
        </button>

        {elements.length > 0 && (
          <button
            type="button"
            onClick={handleToggleBadges}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: badgesVisible ? '#334155' : '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            {badgesVisible ? <EyeOff size={14} color="#f59e0b" /> : <Eye size={14} />}
            <span>{badgesVisible ? 'Hide Badges' : 'Show Badges'}</span>
          </button>
        )}
      </div>

      {/* Find It Search Box */}
      <form
        onSubmit={handleFindIt}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '12px'
        }}
      >
        <label
          htmlFor="find-it-input"
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Crosshair size={14} color="#38bdf8" />
          Find It (Natural Language)
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="find-it-input"
            type="text"
            placeholder="e.g. Where do I upload my resume?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '12px',
              color: '#f8fafc',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isSearching || !question.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0369a1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isSearching || !question.trim() ? 'not-allowed' : 'pointer',
              opacity: isSearching || !question.trim() ? 0.6 : 1
            }}
          >
            <Search size={14} />
            <span>{isSearching ? 'Locating...' : 'Find'}</span>
          </button>
        </div>
      </form>

      {/* Find Result Card */}
      {findResult && (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #0284c7',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sparkles size={13} />
              FIND IT RESULT
            </span>
            {findResult.targetNumber && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  backgroundColor: '#f59e0b',
                  color: '#000000',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}
              >
                Element #{findResult.targetNumber}
              </span>
            )}
          </div>

          {findResult.targetLabel && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
              &ldquo;{findResult.targetLabel}&rdquo;
            </div>
          )}

          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
            {findResult.reason}
          </div>

          {findResult.targetNumber && (
            <button
              type="button"
              onClick={() => handleHighlight(findResult.targetNumber!)}
              style={{
                alignSelf: 'flex-start',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: '1px solid #38bdf8',
                borderRadius: '4px',
                color: '#38bdf8',
                fontSize: '11px',
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              <ExternalLink size={12} />
              <span>Scroll & Pulse Highlight</span>
            </button>
          )}
        </div>
      )}

      {/* Action Step History / Log (Phase 12) */}
      {session && session.steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
            Session Action Log ({session.steps.length} steps)
          </span>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '220px',
              overflowY: 'auto'
            }}
          >
            {session.steps.map((st, idx) => {
              const timeStr = new Date(st.timestamp).toLocaleTimeString('en-US', { hour12: false });
              const actionDisplay = st.action.targetNumber
                ? `${st.action.type.toUpperCase()} #${st.action.targetNumber}`
                : st.action.type.toUpperCase();
              return (
                <div
                  key={st.id || idx}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                      #{idx + 1} · {timeStr} · {actionDisplay}
                    </span>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        backgroundColor:
                          st.decision === 'approve'
                            ? '#064e3b'
                            : st.decision === 'skip'
                            ? '#334155'
                            : st.decision === 'stop'
                            ? '#7f1d1d'
                            : st.phase === 'approved'
                            ? '#064e3b'
                            : st.phase === 'skipped'
                            ? '#334155'
                            : st.phase === 'failed'
                            ? '#7f1d1d'
                            : '#854d0e',
                        color:
                          st.decision === 'approve' || st.phase === 'approved'
                            ? '#6ee7b7'
                            : st.decision === 'skip' || st.phase === 'skipped'
                            ? '#cbd5e1'
                            : st.decision === 'stop' || st.phase === 'failed' || st.phase === 'rejected'
                            ? '#fca5a5'
                            : '#fef08a'
                      }}
                    >
                      {st.decision ? st.decision.toUpperCase() : st.phase}
                    </span>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '10px' }}>
                    {st.reason}
                    {st.action.value && (
                      <span style={{ color: '#94a3b8', marginLeft: '4px' }}>
                        | Value: &ldquo;{st.action.value}&rdquo;
                      </span>
                    )}
                  </div>
                  {st.errorMessage && (
                    <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '2px' }}>
                      Error: {st.errorMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
