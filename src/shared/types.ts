// --- User Data ---
export interface UserProfile {
  name: string;
  college?: string;
  skills: string[];
  links: string[];
  preferredLanguage: 'en' | 'hi';
  preferredTone: 'formal' | 'friendly' | 'plain';
}

export interface SavedSkill {
  id: string;
  name: string;
  description: string;
  category: 'summarize' | 'explain' | 'translate' | 'reply' | 'form' | 'custom';
  promptTemplate: string; // {{selectedText}}, {{pageContent}}, {{profile}}, {{timestamp}}
  createdAt: number;
  updatedAt: number;
}

export interface ExtensionSettings {
  apiKey: string;
  groqApiKey?: string;
  preferredLanguage: 'en' | 'hi';
  stepLimit: number;
  modelTier: 'lite' | 'standard' | 'vision' | 'fallback';
  safetyLevel: 'maximum' | 'standard';
}

// --- Page State & Elements ---
export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedElement {
  id: string; // stable internal id (selector hash)
  number: number; // 1..N visible on the current map
  type:
    | 'button'
    | 'link'
    | 'input'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'other';
  selector: string; // best-effort stable selector
  label: string; // visible label / text / aria
  attributes: Record<string, string>;
  rect: ElementRect;
  value?: string;
  options?: string[]; // for select
  disabled?: boolean;
  required?: boolean;
}

export interface PageState {
  url: string;
  title: string;
  readability?: {
    title: string;
    byline?: string;
    content: string; // sanitized HTML
    textContent: string;
    length: number;
    published?: string;
  };
  screenshotUrl?: string; // data URI (local only)
  elements: DetectedElement[];
  viewport: { width: number; height: number };
  timestamp: number;
}

// --- Agent Action & Session ---
export type ActionType = 'click' | 'type' | 'select' | 'scroll' | 'done' | 'none';

export interface AgentAction {
  type: ActionType;
  targetNumber?: number;
  value?: string; // for type/select
  direction?: 'up' | 'down'; // for scroll
  reason: string; // one-line
  confidence?: number; // 0..1
  requiresExtraConfirm?: boolean; // consequential action flag
}

export interface AgentStep {
  id: string;
  phase: 'propose' | 'approved' | 'skipped' | 'rejected' | 'failed';
  action: AgentAction;
  reason: string;
  decision?: 'approve' | 'skip' | 'stop' | 'deny';
  executed?: boolean;
  errorMessage?: string;
  timestamp: number;
}

export interface AgentSession {
  id: string;
  tabId: number;
  url: string;
  title: string;
  goal: string;
  steps: AgentStep[];
  currentStepIndex: number;
  stepLimit: number;
  dryRunEnabled: boolean;
  running: boolean;
  completed: boolean;
  startedAt: number;
  updatedAt: number;
}

// --- Practice Tasks (Phase 13) ---
export type PracticeTaskCategory = 'form-fill' | 'shop-search' | 'data-collection';

export interface PracticeTask {
  id: string;
  name: string;
  category: PracticeTaskCategory;
  description: string;
  goalTemplate: string; // expandable with profile placeholders
  icon: string;
  safetyNote?: string;
}

export interface CollectedRow {
  page: number;
  fields: Record<string, string>;
  collectedAt: number;
}

export interface PracticeRun {
  id: string;
  taskId: string;
  sessionId: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'stopped';
  collectedData: CollectedRow[];
}

// --- Summaries ---
export interface StructuredSummary {
  tldr: string;
  keyPoints: string[];
  nextSteps?: string[];
  actions?: string[];
}

export interface YouTubeChapter {
  label: string;
  seconds: number;
  snippet?: string;
}

export interface YouTubeSummary {
  videoId: string;
  title: string;
  tldr: string;
  keyPoints: string[];
  chapters: YouTubeChapter[];
  actions: string[];
}

export type SummaryResult =
  | { type: 'article'; summary: StructuredSummary; language: 'en' | 'hi' }
  | { type: 'youtube'; summary: YouTubeSummary; language: 'en' | 'hi' };

// --- Messages ---
export interface BaseMessage {
  type: string;
  payload?: unknown;
}

export type PanelToBg =
  | { type: 'init'; tabId?: number }
  | { type: 'requestSummary' }
  | { type: 'requestYouTubeSummary'; url: string }
  | {
      type: 'chatSend';
      message: string;
      mode: 'page' | 'context';
      history?: Array<{ sender: 'user' | 'assistant'; text: string }>;
      pageContext?: { title: string; textContent: string };
    }
  | { type: 'contextMenu'; action: 'explain' | 'translate' | 'draftReply' }
  | { type: 'screenshotCapture' }
  | { type: 'screenshotAnalyse'; question: string; dataUrl: string }
  | { type: 'scanElements'; showBadges?: boolean }
  | { type: 'toggleBadges'; show: boolean }
  | { type: 'findIt'; question: string }
  | { type: 'highlightElement'; targetNumber: number }
  | { type: 'pageStateRefresh' }
  | { type: 'agentStart'; goal: string; dryRun?: boolean }
  | { type: 'agentNextStep' }
  | { type: 'agentDecide'; decision: 'approve' | 'skip' | 'stop' }
  | { type: 'agentStop' }
  | { type: 'setProfile'; profile: UserProfile }
  | { type: 'upsertSkill'; skill: SavedSkill }
  | { type: 'deleteSkill'; id: string }
  | { type: 'exportSkills'; format: 'json' | 'md' }
  | { type: 'importSkills'; content: string }
  | { type: 'setSettings'; settings: ExtensionSettings }
  | { type: 'exportLog' }
  | { type: 'clearSession' }
  | { type: 'getProfile' }
  | { type: 'getSkills' }
  | { type: 'toggleLanguage'; lang: 'en' | 'hi' }
  | { type: 'refreshLanguage' };

export type BgToPanel =
  | { type: 'panelReady'; tabId: number }
  | { type: 'summary'; result: SummaryResult }
  | { type: 'articleSummary'; summary: StructuredSummary; language: 'en' | 'hi' }
  | { type: 'youtubeSummary'; summary: YouTubeSummary; language: 'en' | 'hi' }
  | { type: 'pageChatResponse'; message: string; contextNote?: string; language: 'en' | 'hi' }
  | { type: 'contextActionResult'; action: 'explain' | 'translate' | 'draftReply'; output: string }
  | { type: 'screenshotAnalysis'; answer: string }
  | { type: 'pageState'; state: PageState }
  | { type: 'pageStateError'; error: string }
  | { type: 'agentNewProposal'; step: AgentStep }
  | { type: 'agentSessionLoaded'; session: AgentSession }
  | { type: 'agentSessionRestored' }
  | { type: 'error'; code: string; message: string; details?: unknown }
  | { type: 'settingsSaved' }
  | { type: 'profileSaved' }
  | { type: 'skillSaved' | 'skillDeleted' | 'skillsLoaded' }
  | { type: 'apiRetry'; attempt: number; retryAfterSecs?: number };

export interface SahayakPackage {
  version: '1.0';
  profile: UserProfile;
  skills: SavedSkill[];
  exportedAt: number;
}
