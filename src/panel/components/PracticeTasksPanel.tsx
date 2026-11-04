/**
 * PracticeTasksPanel.tsx — Phase 13: Practice Tasks
 *
 * Provides a library of curated practice tasks for end-to-end agent testing:
 *  - Form Fill tasks (internship, contact, signup)
 *  - Shop Search tasks (search + filter)
 *  - Data Collection tasks (multi-page table)
 *
 * Each task launches the agent with a pre-built goal.
 * Collected data rows (for data-collection tasks) are stored and exportable as CSV.
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  ClipboardCheck,
  ShoppingCart,
  Table2,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  Trash2,
  BookOpen,
  ShieldCheck
} from 'lucide-react';
import { PracticeRun, CollectedRow } from '@shared/types';
import { practiceRunsStore } from '@shared/storage';
import {
  PRACTICE_TASKS,
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_STYLES
} from '@tools/practiceTasks';
import type { PracticeTask } from '@shared/types';

// ── Category Icons ────────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'form-fill': <ClipboardCheck size={13} />,
  'shop-search': <ShoppingCart size={13} />,
  'data-collection': <Table2 size={13} />
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function exportCSV(rows: CollectedRow[], filename: string) {
  if (!rows.length) return;
  const allKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.fields))));
  const header = ['Page', ...allKeys].join(',');
  const lines = rows.map((r) => [r.page, ...allKeys.map((k) => JSON.stringify(r.fields[k] ?? ''))].join(','));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Task Card ─────────────────────────────────────────────────────────────────
const TaskCard: React.FC<{
  task: PracticeTask;
  onLaunch: (task: PracticeTask) => void;
  isLaunching: boolean;
}> = ({ task, onLaunch, isLaunching }) => {
  const [expanded, setExpanded] = useState(false);
  const style = TASK_CATEGORY_STYLES[task.category];

  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        border: `1px solid ${style.border}`,
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded((p) => !p)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>{task.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {task.name}
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '3px',
                fontSize: '10px',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '9999px',
                backgroundColor: style.bg,
                color: style.color,
                border: `1px solid ${style.border}`
              }}
            >
              {CATEGORY_ICONS[task.category]}
              {TASK_CATEGORY_LABELS[task.category]}
            </div>
          </div>
        </div>
        <span style={{ color: '#64748b', marginLeft: '8px', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid #334155',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
            {task.description}
          </p>

          {/* Goal preview */}
          <div
            style={{
              backgroundColor: '#0f172a',
              borderRadius: '6px',
              padding: '8px 10px',
              border: '1px solid #334155'
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
              Goal Template
            </div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.5', fontStyle: 'italic' }}>
              "{task.goalTemplate}"
            </div>
          </div>

          {/* Safety note */}
          {task.safetyNote && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '6px 8px',
                backgroundColor: '#0f1f10',
                border: '1px solid #166534',
                borderRadius: '5px',
                fontSize: '11px',
                color: '#86efac'
              }}
            >
              <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{task.safetyNote}</span>
            </div>
          )}

          {/* Launch button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onLaunch(task); }}
            disabled={isLaunching}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: isLaunching ? '#1e3a5f' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isLaunching ? 'not-allowed' : 'pointer',
              opacity: isLaunching ? 0.6 : 1,
              transition: 'background-color 0.15s ease'
            }}
          >
            <Play size={13} />
            <span>{isLaunching ? 'Launching...' : 'Launch Task'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ── Collected Data Table ───────────────────────────────────────────────────────
const CollectedDataTable: React.FC<{
  rows: CollectedRow[];
  onClear: () => void;
  runId: string;
}> = ({ rows, onClear, runId }) => {
  if (!rows.length) return null;

  const allKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.fields))));

  return (
    <div
      style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1d4ed8',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      {/* Table header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #1e3a5f',
          backgroundColor: '#0c1a35'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#93c5fd' }}>
          📊 Collected Data ({rows.length} rows)
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => exportCSV(rows, `sahayak_data_${runId}.csv`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: '1px solid #1d4ed8',
              borderRadius: '4px',
              color: '#93c5fd',
              fontSize: '10px',
              padding: '3px 7px',
              cursor: 'pointer'
            }}
          >
            <Download size={11} /> CSV
          </button>
          <button
            type="button"
            onClick={onClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#64748b',
              fontSize: '10px',
              padding: '3px 7px',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={11} /> Clear
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: 'auto', maxHeight: '200px', overflowY: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
            color: '#e2e8f0'
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: '6px 10px',
                  textAlign: 'left',
                  color: '#64748b',
                  fontWeight: 600,
                  borderBottom: '1px solid #1e3a5f',
                  whiteSpace: 'nowrap',
                  position: 'sticky',
                  top: 0,
                  backgroundColor: '#0f172a'
                }}
              >
                Pg
              </th>
              {allKeys.map((k) => (
                <th
                  key={k}
                  style={{
                    padding: '6px 10px',
                    textAlign: 'left',
                    color: '#64748b',
                    fontWeight: 600,
                    borderBottom: '1px solid #1e3a5f',
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#0f172a'
                  }}
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  backgroundColor: i % 2 === 0 ? '#0f172a' : '#0c1630',
                  borderBottom: '1px solid #1e293b'
                }}
              >
                <td style={{ padding: '5px 10px', color: '#475569', fontWeight: 600 }}>
                  {row.page}
                </td>
                {allKeys.map((k) => (
                  <td key={k} style={{ padding: '5px 10px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.fields[k] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Run History ───────────────────────────────────────────────────────────────
const RunHistoryItem: React.FC<{ run: PracticeRun; taskName: string }> = ({ run, taskName }) => {
  const duration = run.completedAt
    ? Math.round((run.completedAt - run.startedAt) / 1000)
    : null;

  const statusColor =
    run.status === 'completed' ? '#22c55e' : run.status === 'stopped' ? '#f59e0b' : '#60a5fa';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '5px',
        fontSize: '11px'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{taskName}</span>
        <span style={{ color: '#475569' }}>
          {new Date(run.startedAt).toLocaleString()}
          {duration !== null && ` · ${duration}s`}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {run.collectedData.length > 0 && (
          <span style={{ fontSize: '10px', color: '#93c5fd' }}>
            {run.collectedData.length} rows
          </span>
        )}
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: statusColor,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: `${statusColor}20`,
            border: `1px solid ${statusColor}40`
          }}
        >
          {run.status}
        </span>
      </div>
    </div>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────
export const PracticeTasksPanel: React.FC<{
  onLaunchTask: (goal: string) => void;
  currentSessionId: string | null;
}> = ({ onLaunchTask, currentSessionId }) => {
  const [runs, setRuns] = useState<PracticeRun[]>([]);
  const [launchingTaskId, setLaunchingTaskId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [collectedRows, setCollectedRows] = useState<CollectedRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    practiceRunsStore.get().then((saved) => {
      if (saved) setRuns(saved);
    });
  }, []);

  // Listen for collected data from background
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    const listener = (msg: any) => {
      if (msg.type === 'collectedDataRow' && msg.row) {
        setCollectedRows((prev) => {
          const updated = [...prev, msg.row as CollectedRow];
          return updated;
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleLaunch = async (task: PracticeTask) => {
    setLaunchingTaskId(task.id);
    setError(null);
    setCollectedRows([]);

    // Create a practice run record
    const runId = `pr-${Date.now()}`;
    const run: PracticeRun = {
      id: runId,
      taskId: task.id,
      sessionId: currentSessionId || '',
      startedAt: Date.now(),
      status: 'running',
      collectedData: []
    };

    const updatedRuns = [run, ...runs.slice(0, 19)]; // Keep last 20
    setRuns(updatedRuns);
    setActiveRunId(runId);
    await practiceRunsStore.set(updatedRuns);

    // Notify background to start agent with practice goal
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: 'agentStart', goal: task.goalTemplate, dryRun: false, practiceRunId: runId },
        (response) => {
          setLaunchingTaskId(null);
          if (!response?.ok) {
            setError(response?.error || 'Failed to launch practice task.');
            // Mark run as stopped
            const failedRuns = updatedRuns.map((r) =>
              r.id === runId ? { ...r, status: 'stopped' as const, completedAt: Date.now() } : r
            );
            setRuns(failedRuns);
            practiceRunsStore.set(failedRuns);
          }
        }
      );
    } else {
      setLaunchingTaskId(null);
      // Fallback: just launch via the parent callback
      onLaunchTask(task.goalTemplate);
    }
  };

  const handleClearCollected = () => setCollectedRows([]);

  const handleClearHistory = async () => {
    setRuns([]);
    await practiceRunsStore.set([]);
  };

  const categories = ['all', 'form-fill', 'shop-search', 'data-collection'];
  const filteredTasks =
    activeCategory === 'all'
      ? PRACTICE_TASKS
      : PRACTICE_TASKS.filter((t) => t.category === activeCategory);

  const latestRunTask = (run: PracticeRun) =>
    PRACTICE_TASKS.find((t) => t.id === run.taskId)?.name ?? run.taskId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <BookOpen size={16} color="#a78bfa" />
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Practice Tasks
          </h3>
        </div>
        <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
          Curated end-to-end agent tasks — each step requires your approval before execution.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            backgroundColor: '#7f1d1d',
            border: '1px solid #b91c1c',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '11px'
          }}
        >
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* Category filter tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '9999px',
              border: '1px solid',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              borderColor: activeCategory === cat ? '#7c3aed' : '#334155',
              backgroundColor: activeCategory === cat ? '#4c1d95' : '#1e293b',
              color: activeCategory === cat ? '#c4b5fd' : '#64748b'
            }}
          >
            {cat === 'all' ? '✨ All' : TASK_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Task cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onLaunch={handleLaunch}
            isLaunching={launchingTaskId === task.id}
          />
        ))}
      </div>

      {/* Collected data table (data-collection tasks) */}
      {collectedRows.length > 0 && (
        <CollectedDataTable
          rows={collectedRows}
          onClear={handleClearCollected}
          runId={activeRunId || 'export'}
        />
      )}

      {/* Run history */}
      <div>
        <button
          type="button"
          onClick={() => setShowHistory((p) => !p)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '0'
          }}
        >
          {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Run History ({runs.length})
          {runs.length > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClearHistory(); }}
              style={{
                marginLeft: '4px',
                background: 'none',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0
              }}
              title="Clear history"
            >
              <Trash2 size={11} />
            </button>
          )}
        </button>

        {showHistory && (
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: '180px',
              overflowY: 'auto'
            }}
          >
            {runs.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>No runs yet.</p>
            ) : (
              runs.map((run) => (
                <RunHistoryItem key={run.id} run={run} taskName={latestRunTask(run)} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeTasksPanel;
