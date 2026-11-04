import React, { useState, useEffect } from 'react';
import { User, Save, CheckCircle, AlertCircle, Plus, Trash2, Globe, MessageSquare } from 'lucide-react';
import { UserProfile } from '@shared/types';
import { profileStore } from '@shared/storage';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  college: '',
  skills: [],
  links: [],
  preferredLanguage: 'en',
  preferredTone: 'friendly'
};

export const ProfilePanel: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [skillInput, setSkillInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const saved = await profileStore.get();
      if (saved) {
        setProfile({
          ...DEFAULT_PROFILE,
          ...saved
        });
      }
    } catch (err) {
      console.warn('Could not load profile:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      setStatusMessage({ text: 'Please enter your name.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      await profileStore.set(profile);
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'setProfile', profile }, () => {
          setIsSaving(false);
          setStatusMessage({ text: 'Profile saved successfully!', type: 'success' });
          setTimeout(() => setStatusMessage(null), 3000);
        });
      } else {
        setIsSaving(false);
        setStatusMessage({ text: 'Profile saved successfully!', type: 'success' });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err: any) {
      setIsSaving(false);
      setStatusMessage({ text: err?.message || 'Failed to save profile.', type: 'error' });
    }
  };

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (!profile.skills.includes(trimmed)) {
      setProfile((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove)
    }));
  };

  const handleAddLink = () => {
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    if (!profile.links.includes(trimmed)) {
      setProfile((prev) => ({ ...prev, links: [...prev.links, trimmed] }));
    }
    setLinkInput('');
  };

  const handleRemoveLink = (linkToRemove: string) => {
    setProfile((prev) => ({
      ...prev,
      links: prev.links.filter((l) => l !== linkToRemove)
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
          User Profile
        </h2>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
          Personal info used securely and locally to assist with form fills and reply drafts.
        </p>
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

      <form
        onSubmit={handleSave}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '14px'
        }}
      >
        {/* Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>Full Name *</label>
          <input
            type="text"
            placeholder="e.g. Tarun Sharma"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '12px',
              color: '#f8fafc',
              outline: 'none'
            }}
          />
        </div>

        {/* College / Institution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>College / University</label>
          <input
            type="text"
            placeholder="e.g. Masai School / IIT Delhi"
            value={profile.college || ''}
            onChange={(e) => setProfile({ ...profile, college: e.target.value })}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '12px',
              color: '#f8fafc',
              outline: 'none'
            }}
          />
        </div>

        {/* Preferred Tone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>Preferred Tone</label>
          <select
            value={profile.preferredTone}
            onChange={(e) => setProfile({ ...profile, preferredTone: e.target.value as any })}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '12px',
              color: '#f8fafc',
              outline: 'none'
            }}
          >
            <option value="formal">Formal & Professional</option>
            <option value="friendly">Friendly & Warm</option>
            <option value="plain">Direct & Plain</option>
          </select>
        </div>

        {/* Skills Tag Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>Key Skills</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="e.g. React, TypeScript, Node.js"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSkill();
                }
              }}
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
              type="button"
              onClick={handleAddSkill}
              style={{
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Add
            </button>
          </div>
          {profile.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #0284c7',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    color: '#38bdf8'
                  }}
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Portfolio / Profile Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>Profile Links</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="e.g. https://github.com/myname"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLink();
                }
              }}
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
              type="button"
              onClick={handleAddLink}
              style={{
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Add
            </button>
          </div>
          {profile.links.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {profile.links.map((link) => (
                <div
                  key={link}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: '#93c5fd'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {link}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(link)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={isSaving}
          style={{
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer'
          }}
        >
          <Save size={15} />
          <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </form>
    </div>
  );
};

export default ProfilePanel;

