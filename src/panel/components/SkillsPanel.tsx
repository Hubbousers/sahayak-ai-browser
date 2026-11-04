import React, { useState, useEffect } from 'react';
import { Zap, Plus, Trash2, Download, Upload, Save, CheckCircle, AlertCircle, Edit2, X } from 'lucide-react';
import { SavedSkill, UserProfile, ExtensionSettings } from '@shared/types';
import { skillsStore, profileStore, settingsStore } from '@shared/storage';

export const SkillsPanel: React.FC = () => {
  const [skills, setSkills] = useState<SavedSkill[]>([]);
  const [editingSkill, setEditingSkill] = useState<Partial<SavedSkill> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const saved = await skillsStore.get();
      if (saved) setSkills(saved);
    } catch (err) {
      console.warn('Could not load skills:', err);
    }
  };

  const handleOpenAddModal = () => {
    setEditingSkill({
      id: `skill_${Date.now()}`,
      name: '',
      description: '',
      category: 'custom',
      promptTemplate: 'Please summarize this text clearly: {{selectedText}}',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (skill: SavedSkill) => {
    setEditingSkill({ ...skill });
    setIsModalOpen(true);
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill?.name?.trim() || !editingSkill?.promptTemplate?.trim()) {
      setStatusMessage({ text: 'Skill name and prompt template are required.', type: 'error' });
      return;
    }

    const fullSkill: SavedSkill = {
      id: editingSkill.id || `skill_${Date.now()}`,
      name: editingSkill.name.trim(),
      description: editingSkill.description?.trim() || '',
      category: (editingSkill.category as any) || 'custom',
      promptTemplate: editingSkill.promptTemplate.trim(),
      createdAt: editingSkill.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    const updated = [...skills.filter((s) => s.id !== fullSkill.id), fullSkill];
    setSkills(updated);
    await skillsStore.set(updated);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'upsertSkill', skill: fullSkill });
    }

    setIsModalOpen(false);
    setEditingSkill(null);
    setStatusMessage({ text: 'Skill saved successfully!', type: 'success' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDeleteSkill = async (id: string) => {
    const updated = skills.filter((s) => s.id !== id);
    setSkills(updated);
    await skillsStore.set(updated);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'deleteSkill', id });
    }

    setStatusMessage({ text: 'Skill deleted.', type: 'success' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Phase 14: Export Sahayak Package (Profile + Skills + Settings)
  const handleExportData = async () => {
    try {
      const [profile, allSkills, settings] = await Promise.all([
        profileStore.get(),
        skillsStore.get(),
        settingsStore.get()
      ]);

      const bundle = {
        version: '1.0',
        exportedAt: Date.now(),
        profile: profile || {},
        skills: allSkills || [],
        settings: {
          preferredLanguage: settings?.preferredLanguage || 'en',
          modelTier: settings?.modelTier || 'lite',
          stepLimit: settings?.stepLimit || 15
        }
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sahayak_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage({ text: 'Exported backup package successfully!', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Export failed.', type: 'error' });
    }
  };

  // Phase 14: Import Sahayak Package
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON structure.');
        }

        // Restore Profile if provided
        if (parsed.profile && typeof parsed.profile === 'object') {
          await profileStore.set(parsed.profile);
        }

        // Restore Skills if provided
        if (Array.isArray(parsed.skills)) {
          const mergedSkills = [...skills];
          for (const s of parsed.skills) {
            if (s && s.id && s.name && s.promptTemplate) {
              const idx = mergedSkills.findIndex((ex) => ex.id === s.id);
              if (idx >= 0) mergedSkills[idx] = s;
              else mergedSkills.push(s);
            }
          }
          setSkills(mergedSkills);
          await skillsStore.set(mergedSkills);
        }

        setStatusMessage({ text: 'Package imported successfully!', type: 'success' });
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (importErr: any) {
        setStatusMessage({ text: `Import failed: ${importErr?.message || 'Invalid format'}`, type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Prompt Skills & Memory
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Custom prompts with template interpolation (e.g. &#123;&#123;selectedText&#125;&#125;, &#123;&#123;profile&#125;&#125;).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={handleExportData}
            title="Export profile and skills as JSON"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            <Download size={13} />
            <span>Export</span>
          </button>

          <label
            title="Import profile and skills JSON file"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            <Upload size={13} />
            <span>Import</span>
            <input type="file" accept=".json" onChange={handleImportData} style={{ display: 'none' }} />
          </label>

          <button
            type="button"
            onClick={handleOpenAddModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <Plus size={13} />
            <span>Add Skill</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: statusMessage.type === 'success' ? '#064e3b' : '#7f1d1d',
            border: `1px solid ${statusMessage.type === 'success' ? '#059669' : '#dc2626'}`,
            borderRadius: '6px',
            color: statusMessage.type === 'success' ? '#6ee7b7' : '#fecaca',
            fontSize: '12px'
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Skills List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {skills.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#94a3b8',
              fontSize: '12px'
            }}
          >
            No custom prompt skills created yet. Click <strong>Add Skill</strong> to define one!
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.id}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                    {skill.name}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#0f172a',
                      color: '#38bdf8',
                      border: '1px solid #0284c7'
                    }}
                  >
                    {skill.category}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(skill)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSkill(skill.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {skill.description && (
                <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                  {skill.description}
                </div>
              )}

              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  backgroundColor: '#0f172a',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  color: '#93c5fd',
                  border: '1px solid #1e293b',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {skill.promptTemplate}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Skill Modal */}
      {isModalOpen && editingSkill && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
              padding: '16px',
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                {editingSkill.id ? 'Edit Skill' : 'New Prompt Skill'}
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSkill} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>Skill Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Concise Bullet Summary"
                  value={editingSkill.name || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>Category</label>
                <select
                  value={editingSkill.category || 'custom'}
                  onChange={(e) => setEditingSkill({ ...editingSkill, category: e.target.value as any })}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                >
                  <option value="custom">Custom</option>
                  <option value="summarize">Summarize</option>
                  <option value="explain">Explain</option>
                  <option value="translate">Translate</option>
                  <option value="reply">Reply</option>
                  <option value="form">Form Fill</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>Description</label>
                <input
                  type="text"
                  placeholder="Short note about when to use this skill"
                  value={editingSkill.description || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
                  Prompt Template (Use &#123;&#123;selectedText&#125;&#125;, &#123;&#123;profile&#125;&#125;) *
                </label>
                <textarea
                  rows={4}
                  value={editingSkill.promptTemplate || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, promptTemplate: e.target.value })}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    backgroundColor: '#334155',
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsPanel;

