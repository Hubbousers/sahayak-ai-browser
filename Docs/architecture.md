# Sahayak — Architecture Design

Document version: 1.0
Scope: Chrome Extension Manifest V3, Chrome Side Panel, Gemini + Groq AI stack, local-only memory, human-in-the-loop browser agent.

---

## 1. System Context

```
┌───────────────────────────────────────────────────────────────────────┐
│  User works on a normal Chrome page (news article, YouTube, form,     │
│  practice shop, forum, email draft, etc.)                              │
└───────────────────────────────────────────────────────────────────────┘
        │
        │ 1. Tab selected / focus change / side panel opening
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  CHROME BROWSER                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │  SIDE PANEL (Sahayak UI)                                    │       │
│  │  - Tab: Summarise | Page Chat | Screenshot | Agent | Skills │       │
│  │  - Output area, chat bubbles, action map badges overlay      │       │
│  │  - Agent controls (Approve / Skip / Stop / Dry-run)          │       │
│  │  - Settings, profile, action log                             │       │
│  └────────────────────────┬────────────────────────────────────┘       │
│                           │ 2. chrome.tabs.sendMessage /              │
│                           │    runtime.sendMessage                     │
│  ┌────────────────────────┴────────────────────────────────────┐       │
│  │  CONTENT SCRIPT (in page)                                   │       │
│  │  - Readability.js article extraction                         │
│  │  - Interactive-element scanner → numbered DOM map            │
│  │  - Overlay badges for numbered elements                      │
│  │  - DOM mutation observers for page-state changes             │
│  │  - Executed actions: click, type, select, scroll             │
│  └────────────────────────────────────────────────────────────┘       │
│  ┌────────────────────────────────────────────────────────────┐       │
│  │  BACKGROUND SERVICE WORKER                                  │       │
│  │  - Side panel registration & lifecycle                     │
│  │  - Messaging router (panel ↔ content ↔ UI helpers)         │       │
│  │  - Agent loop orchestrator + persistence                     │
│  │  - Safety guard (URL filter, field-type filter,             │
│  │    consequential-action confirmation)                        │
│  │  - Profile + skills (chrome.storage.local)                 │
│  │  - API orchestration: Gemini Flash-Lite / Flash / Groq     │
│  │    - model routing, retry/backoff, 429 handling             │
│  │  - Screenshot capture via chrome.tabs.captureVisibleTab     │
│  └────────────────────────────────────────────────────────────┘       │
│  ┌────────────────────────────────────────────────────────────┐       │
│  │  EXTENSIONS / EXTERNAL                                     │       │
│  │  - Gemini API (Flash-Lite default, Flash for image/         │
│  │    reasoning)                                                │
│  │  - Groq (text-only fallback)                               │
│  │  - Mozilla Readability.js                                  │
│  │  - YouTube Transcript API / public video metadata            │
│  └────────────────────────────────────────────────────────────┘       │
└───────────────────────────────────────────────────────────────────────┘
```

**Key principles**

- Everything that touches the user's data, decisions, or safety lives in the extension (not a backend).
- The model **never** executes anything. It only produces JSON instructions that the side-panel code validates and asks the user about.
- Chrome's Service Worker sleeps; all agent state is persisted to `chrome.storage.local` and reloadable.

---

## 2. Directory Structure

```
sahayak/
├─ package.json
├─ tsconfig.json
├─ tailwind.config.js        (optional, for panel UI)
├─ vite.config.ts            (optional, dev server / HMR for panel)
│
├─ public/
│  ├─ icons/                  # 16/48/128px extension icons
│  ├─ styles/
│  │  ├─ panel.css            # base styles shared by panel & overlay
│  │  └─ overlay.css          # badge / highlight overlay styles
│  └─ fonts/                 # (optional) local fonts
│
├─ src/
│  ├─ manifest.json           # Manifest V3 (side panel, permissions)
│  │
│  ├─ background/
│  │  └─ service_worker.ts
│  │
│  ├─ content/
│  │  ├─ content_script.ts
│  │  ├─ readability.ts       # Readability.js adapter
│  │  ├─ scanner.ts           # interactive-element scanning
│  │  ├─ overlay.ts           # numbered badges / highlights
│  │  ├─ actions.ts           # click/type/select/scroll execution
│  │  └─ types.ts
│  │
│  ├─ panel/
│  │  ├─ index.html          # side-panel shell
│  │  ├─ index.tsx           # React app (chat, tabs, forms, logs)
│  │  ├─ components/
│  │  │  ├─ TabNavigator.tsx
│  │  │  ├─ Chat.tsx
│  │  │  ├─ SummarizePanel.tsx
│  │  │  ├─ ScreenshotPanel.tsx
│  │  │  ├─ AgentPanel.tsx   # approval UI + action map + log
│  │  │  ├─ SkillsPanel.tsx
│  │  │  ├─ ProfilePanel.tsx
│  │  │  ├─ SettingsPanel.tsx
│  │  │  ├─ ActionCard.tsx
│  │  │  └─ ErrorBanner.tsx
│  │  └─ styles/
│  │
│  ├─ shared/
│  │  ├─ types.ts            # message + state type definitions
│  │  ├─ storage.ts          # chrome.storage wrappers (profile, skills, config)
│  │  ├─ safety.ts           # URL/field/element safety guards
│  │  ├─ model.ts            # Gemini / Groq client + routing + retries
│  │  ├─ youtube.ts          # public YouTube extraction
│  │  ├─ language.ts         # English ↔ Hinglish helpers & prompt tuning
│  │  ├─ json.ts             # robust JSON extraction/validation
│  │  ├─ errors.ts           # typed extension errors
│  │  └─ constants.ts
│  │
│  └─ tools/
│     ├─ prompt-templates.ts  # prompt builders per capability
│     └─ utils.ts
```

**Separation of concerns**

- `background`: orchestration, state, safety, persistence, external APIs.
- `content`: page reading, scanning, DOM writing/reading, user actions.
- `panel`: all UI.
- `shared`: pure, type-safe logic usable by both.

---

## 3. Chrome Extension Shell

### 3.1 Manifest (`manifest.json`)

```jsonc
{
  "manifest_version": 3,
  "name": "Sahayak — Your Browser Assistant",
  "version": "1.0.0",
  "description": "AI assistant that reads, understands, and acts on web pages with your approval.",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs",
    "contextMenus",
    "sidePanel",
    "clipboardWrite"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_icon": { "16": "public/icons/icon16.png", "48": "public/icons/icon48.png", "128": "public/icons/icon128.png" },
    "default_title": "Open Sahayak"
  },
  "side_panel": {
    "default_path": "panel/index.html",
    "default_width": 400
  },
  "background": {
    "service_worker": "src/background/service_worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/content_script.ts"],
      "css": ["public/styles/panel.css"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["public/styles/panel.css", "public/styles/overlay.css"],
      "matches": ["<all_urls>"]
    }
  ],
  "commands": {
    "open-side-panel": {
      "suggested_key": { "default": "Ctrl+Shift+Y" },
      "description": "Open the Sahayak side panel"
    }
  },
  "minimum_chrome_version": "114"
}
```

### 3.2 Background service worker responsibilities

1. **Lifecycle**: register side panel, open on `extensionInstalled`, `action.onClicked`, command, context menu click, tab focus change (optional).
2. **Messaging router**: `chrome.runtime.onMessage` dispatcher → send to correct content script via `chrome.tabs.sendMessage`.
3. **Agent orchestrator**: owns session state (`AgentSession`), calls `buildPageState` → `model.nextAction` → `validateAction` → present for approval → execute → repeat.
4. **Persistence**: save/load `AgentSession`, `UserProfile`, `UserSkills`, settings on every mutation.
5. **Screenshot**: `chrome.tabs.captureVisibleTab(tabId, {format})`.
6. **API**: route to Gemini (Flash-Lite/Flash) or Groq, apply retry/backoff for 429/500/503.

### 3.3 Side panel entry

`panel/index.html` loads a React bundle (`panel/index.tsx`) with a small bootstrap that reads:

- current tab URL (for safety check)
- saved API key
- saved profile / skills

---

## 4. Data Models

### 4.1 Shared types (`src/shared/types.ts`)

```ts
// --- user data ---
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
  promptTemplate: string;   // {{selectedText}}, {{pageContent}}, {{profile}}, {{timestamp}}
  createdAt: number;
  updatedAt: number;
}

// --- page state ---
export interface DetectedElement {
  id: string;              // stable internal id (selector hash)
  number: number;          // 1..N visible on the current map
  type:
    | 'button'
    | 'link'
    | 'input'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'other';
  selector: string;        // best-effort stable selector
  label: string;           // visible label / text / aria
  attributes: Record<string, string>;
  rect: { x, y, width, height };
  value?: string;
  options?: string[];      // for select
  disabled?: boolean;
  required?: boolean;
}

export interface PageState {
  url: string;
  title: string;
  readability?: {
    title: string;
    byline?: string;
    content: string;       // sanitized HTML
    textContent: string;
    length: number;
  };
  screenshotUrl?: string;  // data URI (local only)
  elements: DetectedElement[];
  viewport: { width, height };
  timestamp: number;
}

// --- agent ---
export type ActionType = 'click' | 'type' | 'select' | 'scroll' | 'done' | 'none';

export interface AgentAction {
  type: ActionType;
  targetNumber?: number;
  value?: string;                    // for type/select
  direction?: 'up' | 'down';         // for scroll
  reason: string;                    // one-line
  confidence?: number;               // 0..1
  requiresExtraConfirm?: boolean;    // consequential action flag
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

// --- messages ---
export interface BaseMessage {
  type: string;
  payload?: unknown;
}

export type PanelToBg =
  | { type: 'init'; tabId?: number }
  | { type: 'requestSummary' }
  | { type: 'requestYouTubeSummary'; url: string }
  | { type: 'chatSend'; message: string; mode: 'page' | 'context' }
  | { type: 'contextMenu'; action: 'explain' | 'translate' | 'draftReply' }
  | { type: 'screenshotCapture' }
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
```

### 4.2 Profile storage

```ts
// src/shared/storage.ts
const PROFILE_KEY   = 'sahayak_profile';
const SKILLS_KEY    = 'sahayak_skills';
const SETTINGS_KEY  = 'sahayak_settings';
const SESSIONS_KEY  = 'sahayak_sessions';
const ACTIVE_KEY    = 'sahayak_active_session_id';
const LANGUAGE_KEY  = 'sahayak_language';

export const profileStore = new Storage<UserProfile>(PROFILE_KEY);
export const skillsStore  = new Storage<SavedSkill[]>(SKILLS_KEY);
export const settingsStore = new Storage<ExtensionSettings>(SETTINGS_KEY);
export const sessionsStore = new Storage<Record<string, AgentSession>>(SESSIONS_KEY);
```

All reads/writes go through `chrome.storage.local` (never remote).

---

## 5. Message Protocol

All inter-component communication uses `chrome.runtime.sendMessage` with a strongly typed payload.

```
SIDE PANEL → BACKGROUND
  - init, requestSummary, requestYouTubeSummary, chatSend, contextMenu
  - screenshotCapture, pageStateRefresh
  - agentStart, agentNextStep, agentDecide, agentStop
  - setProfile, upsertSkill, deleteSkill, export/importSkills
  - setSettings, toggleLanguage, getProfile, getSkills, clearSession

BACKGROUND → SIDE PANEL
  - panelReady, summary, articleSummary, youtubeSummary
  - pageChatResponse, contextActionResult, screenshotAnalysis
  - pageState, pageStateError, agentNewProposal
  - agentSessionLoaded, agentSessionRestored, error, apiRetry
  - settingsSaved, profileSaved, skillSaved, skillDeleted, skillsLoaded

BACKGROUND ↔ CONTENT SCRIPT (via chrome.tabs.sendMessage(tabId))
  - getContent: { type:'getPageState' } → { type:'pageState', state }
  - screenshot: { type:'captureScreenshot' } → { type:'screenshot', dataUrl }
  - executeAction: { type:'execute', action, dryRun } → { type:'executed' | 'failed' }
  - refreshState: { type:'refreshPageState' } → { type:'pageState', state }
  - contextMenu: { type:'contextMenuRequest' } → { type:'contextMenuResult', ... }
```

**Important:** background → content requires `tabId`; content → background does not. The panel always goes through background, which enforces safety checks before contacting content.

---

## 6. Model Layer

### 6.1 Model selection & routing

```ts
// src/shared/model.ts
type ModelTier = 'lite' | 'standard' | 'vision' | 'fallback';

interface ModelConfig {
  name: string;
  provider: 'gemini' | 'groq';
  supportsImages: boolean;
  supportsStructuredJson: boolean;
}

const MODELS: Record<ModelTier, ModelConfig> = {
  lite:      { name: 'gemini-3.5-flash-lite', provider: 'gemini', supportsImages: false, supportsStructuredJson: true },
  standard:  { name: 'gemini-2.0-flash',     provider: 'gemini', supportsImages: false, supportsStructuredJson: true },
  vision:    { name: 'gemini-3.5-flash-lite', provider: 'gemini', supportsImages: true, supportsStructuredJson: true },
  fallback:  { name: 'llama-3.1-8b-instant',  provider: 'groq',   supportsImages: false, supportsStructuredJson: true },
};

async function resolveModel(intent: ModelIntent): Promise<ModelTier> {
  // heuristics: image → vision; complex reasoning → standard; text-only routine → lite
  if (intent.hasImage) return 'vision';
  if (['find_it', 'agent_next_action', 'structured_json'].includes(intent.kind))
    return intent.difficulty === 'hard' ? 'standard' : 'lite';
  return 'lite';
}
```

### 6.2 Client wrappers

```ts
// src/shared/model/geminiClient.ts
async function geminiChat(config: ModelConfig, messages: GeminiMessages, options: {
  temperature?: number;
  responseSchema?: object;   // for structured outputs
}): Promise<string> { ... }

// src/shared/model/groqClient.ts
async function groqChat(messages: ChatMessage[], config: ModelConfig): Promise<string> { ... }

// src/shared/model/orchestrate.ts
export async function generateText(params: {
  messages: string[] | GeminiMessages;
  intent: ModelIntent;
  apiKey: string;
  temperature?: number;
}): Promise<GenerationResult> {
  const tier = await resolveModel(params.intent);
  const model = MODELS[tier];
  try {
    const text = model.provider === 'gemini'
      ? await geminiChat(model, params.messages, params)
      : await groqChat(params.messages, model);
    return { text, model: model.name, tier, provider: model.provider, success: true };
  } catch (e) {
    return await handleApiError(e, tier, params, generateText); // retry/backoff/fallback
  }
}
```

### 6.3 Retry & rate-limit handling

```ts
async function handleApiError(error, tier, params, next: (p: any) => Promise<any>) {
  const code = error.response?.status;
  const maxTries = tier === 'lite' ? 3 : 2;

  for (let i = 0; i < maxTries; i++) {
    if (code === 429) {
      const retryAfter = extractRetryAfter(error) ?? Math.round(2 ** i * 1.5);
      panelMessage('apiRetry', { attempt: i + 1, retryAfterSecs: retryAfter });
      await sleep(retryAfter * 1000);
      const res = await next(params);
      if (res.success) return res;
    } else if (code && code >= 500) {
      await sleep(1000 * (i + 1));
      const res = await next(params);
      if (res.success) return res;
    } else {
      break;
    }
  }
  return { text: null, model: tier, success: false, error: buildUserError(code) };
}
```

User-visible errors: "The model is currently busy. I'll wait and try again." / "Connection issue — check your API key and network."

### 6.4 Structured JSON extraction

Model responses must be strict JSON. Because LLMs sometimes add markdown or extra text, always extract with a regex + fallback parser:

```ts
function extractJson(input: string): { success: true, data: unknown } | { success: false, error: string } {
  const m = input.match(/```(?:json)?\s*([\s\S]*?)```/) || input.match(/\{[\s\S]*\}/);
  const candidate = m ? m[1] : input;
  try { return { success: true, data: JSON.parse(candidate.trim()) }; }
  catch (e) { return { success: false, error: 'Model did not return valid JSON.' }; }
}
```

Always validate against a Zod schema before using:

```ts
const AgentActionSchema = z.object({
  type: z.enum(['click','type','select','scroll','done','none']),
  targetNumber: z.number().int().min(1).max(50).optional(),
  value: z.string().optional(),
  direction: z.enum(['up','down']).optional(),
  reason: z.string().min(3).max(160),
  confidence: z.number().min(0).max(1).optional(),
  requiresExtraConfirm: z.boolean().optional().default(false),
});
```

Invalid JSON → ask model to retry once; on repeated failure → show "I couldn't understand my instructions. Please rephrase your task."

---

## 7. Content Layer

### 7.1 Article extraction (`readability.ts`)

```ts
// Use Mozilla Readability.js (bundled via npm or external script)
export async function extractArticle(tabId: number): Promise<ReadabilityResult | null> {
  const html = await getTabHtml(tabId);
  const doc = parseHtml(html);
  const reader = new Readability(doc, { charThreshold: 200 });
  const article = reader.parse();
  if (!article) return null;
  return {
    title: article.title,
    byline: article.byline,
    content: article.content,          // sanitized HTML for highlighting
    textContent: article.textContent,  // for prompts & grounding
    length: article.textContent.length,
    published: extractDate(article),
  };
}
```

Used by: `Summarize`, `Page Chat` (fallback), `Extract` context menu.

### 7.2 Public YouTube summary (`youtube.ts`)

```ts
export async function extractYouTube(url: string): Promise<YouTubeContent> {
  const vid = parseYouTubeId(url);
  if (!vid) throw new Error('Unsupported or private YouTube link.');
  const transcript = await fetchTranscript(vid);   // auto-generated or manual
  const meta     = await fetchVideoMetadata(vid);   // title, channel, duration

  // chapter timestamps are available only when provided in the transcript/VTT
  return { videoId: vid, title: meta.title, transcript, chapters: [] };
}
```

If a transcript is unavailable, fall back to: title, description, channel, and a note that summarisation needs a supported public transcript. **Never** attempt to access private/unlisted content.

Summary format (structured, JSON):

```json
{
  "tldr": "...",
  "keyPoints": ["...", "...", "...", "...", "..."],
  "chapters": [
    { "label": "Intro", "seconds": 42, "snippet": "..." },
    ...
  ],
  "actions": ["...", "...", "..."]
}
```

### 7.3 Interactive-element scanner (`scanner.ts`)

Scans for: buttons, links (`<a href>`), inputs (`text|email|tel|number|search|url|date|time|color|file|hidden` excluded from action), textareas, selects, checkboxes, radios, `[role="button"]`, `[role="checkbox"]`, `[role="combobox"]`, `contenteditable` elements with text.

```ts
export function scanElements(tabId: number): Promise<DetectedElement[]> {
  return sendMessageToContent(tabId, { type: 'scanElements' });
}

// In content_script
function buildElement(el: Element, numbers: number[]): DetachedElementPayload {
  const label = extractLabel(el);       // aria-label, alt, textContent trimmed, name, placeholder
  const type  = classify(el);
  const sel   = computeStableSelector(el); // nth-based + attribute hash
  return { id: sel, type, selector: sel, label, value: getValue(el), ... };
}
```

Selector stability: prefer attribute-based hashes with an `nth-of-type` fallback so badges persist across modest DOM changes.

### 7.4 Overlay (`overlay.ts`)

- Creates a fixed-position overlay container above the page.
- For each numbered element, renders an absolute badge with a number + small highlight box.
- Handles resize/scroll: recompute positions via `DOMRect` each frame or on `resize`/`scroll` throttled.
- `dryRun` mode: highlight intended element without click.
- `cleanup()` to remove badges (on agent stop, session change, tab unload).

### 7.5 Actions (`actions.ts`)

Executed only in content script after approval:

```ts
type ExecutionResult = { success: true } | { success: false; reason: string };

export async function executeAction(tabId: number, action: AgentAction, dryRun: boolean): Promise<ExecutionResult> {
  const el = getElementByNumber(tabId, action.targetNumber);
  if (!el) return { success: false, reason: 'Target element no longer exists.' };
  if (action.type === 'click')       return safeClick(el, dryRun);
  if (action.type === 'type')        return safeType(el, action.value!, dryRun);
  if (action.type === 'select')      return safeSelect(el, action.value!, dryRun);
  if (action.type === 'scroll')      return scrollTab(action.direction!);
  if (action.type === 'done')        return { success: true };
  return { success: true };
}

function safeType(input: HTMLInputElement | HTMLTextAreaElement, value: string, dryRun: boolean) {
  // NEVER write to type=password, type=otp, name~/(password|passphrase|pwd|token|otp|one-time)/i,
  // or card-related selectors. Safety checked again in background.
  if (dryRun) return highlight(input);
  dispatchInputEvents(input, value);  // composition + input + change for modern frameworks
  return { success: true };
}
```

`dispatchInputEvents` must fire `input` and `change` events so React/Vue/Angular apps react to typed values.

### 7.6 Content script lifecycle

- Loaded on `<all_urls>` at `document_idle` (lightweight; scanning is lazy).
- Exposes `window.Sahayak` global for potential debugging (development only).
- Listens to `chrome.runtime.onMessage` from background and posts results back.
- Unloads automatically when tab unloads.

---

## 8. Safety Layer (`src/shared/safety.ts`)

Enforced by **code**, not by prompt instructions.

### 8.1 URL blocklist & sensitive domains

```ts
export const SENSITIVE_DOMAINS = [
  /^https?:\/\/(?:(?:www\.)?bank)?\d*\.bankof\w+\.com/,          // example patterns
  /.*\.(?:upi|payment|paypal|stripe|razorpay|paytm|gopay|phonepe|googlepay).*/,
  /.*login\..*/,                                                   // broad login guard
  /.*\.onion/,                                                    // Tor
];

export const PROTECTED_PATHS = [
  /\/(checkout|cart|payment|billing|wallet|topup|recharge|fund|transfer)\//i,
  /\/(settings|account|profile)\//i,                             // allow, but block writes
];

export function isBlockedUrl(url: string): boolean {
  return SENSITIVE_DOMAINS.some(re => re.test(url)) ||
         PROTECTED_PATHS.some(re => re.test(url));
}
```

When blocked: agent mode is disabled, all action proposals return `done` with reason "This page type is restricted for safety reasons.", chat/summarise still allowed (content stays local; **do not** send to free-tier if the page is a login/payment/OTP page — see 8.5).

### 8.2 Field protection

```ts
const PASSWORD_RE  = /password|passphrase|pwd|secret|passcode|pin/i;
const OTP_RE       = /otp|one.?time|verify.?code|validation.?code/i;
const CARD_RE      = /card|ccnumber|card.?number|cvv|expiry|cvc|pan/i;

export function isProtectedField(element: DetectedElement): boolean {
  const name  = (element.attributes.name || '').toLowerCase();
  const type  = (element.type || '').toLowerCase();
  const label = (element.label || '').toLowerCase();
  const value = (element.value || '').toLowerCase();

  if (type === 'password')          return true;
  if (PASSWORD_RE.test(name + label + type)) return true;
  if (OTP_RE.test(name + label))    return true;
  if (CARD_RE.test(name + label + value)) return true;
  return false;
}
```

Never propose `type` actions on protected fields; immediately fail with "This field is protected — I won't type into it."

### 8.3 Consequential-action confirmation

```ts
const CONSEQUENTIAL_SELECTORS = [
  /\bsubmit\b/i, /\bsend\b/i, /\bpay\b/i, /\bcheckout\b/i,
  /\bsave\b/i, /\bdelete\b/i, /\bremove\b/i, /\bcancel\b/i,
  /\bconfirm\b/i, /\bapprove\b/i,
];

export function isConsequential(element: DetectedElement): boolean {
  const text = (element.label + ' ' + element.value).toLowerCase();
  const sel  = element.selector.toLowerCase();
  return CONSEQUENTIAL_SELECTORS.some(re => re.test(text) || re.test(sel));
}
```

Consequential actions require an explicit second confirmation modal in the panel ("This will Submit. Proceed?").

### 8.4 Action-type allowlist

Only allow: `click`, `type`, `select`, `scroll`, `done`, `none`. **No** `navigate`, `reload`, `delete`, `executeScript` from the model.

### 8.5 Privacy gating

- Before any external AI call: run `isBlockedUrl(url)`. If blocked → do not send page content to external models; respond locally with a safety message.
- For free-tier (Groq/lite): refuse to send pages whose URL matches sensitive patterns; prefer local or standard Gemini for such pages if a key is provided.
- Screenshots for private pages: only take after explicit user intent and never retain after the answer is delivered.

### 8.6 Kill switch

Visible `STOP` button in the agent header at all times:

```ts
export function stopAgent(sessionId: string) {
  session.running = false;
  persistSession(sessionId);
  panelMessage('agentStopped');
}
```

---

## 9. Agent Architecture

### 9.1 Session lifecycle

```
User asks → init session (AgentSession: running=false, steps=[], goal)
  ↓
Start (agentStart): set running=true, save, read page state
  ↓  (loop)
BuildPageState → buildPrompt(goal + page state) → model.nextAction
  → validateAction(JSON + schema + safety) → create AgentStep(phase='propose')
  → present to user (panel: action card + reason + map highlight)
  → user: Approve / Skip / Stop / Dry-run
    - Approve → execute (background → content) → create AgentStep(phase='approved')
    - Skip    → create AgentStep(phase='skipped'), no execute
    - Stop    → session.running=false, final step 'rejected'
  → if action succeeded & type !== 'done': refreshPageState, loop again
  → if type === 'done' or error: session.completed=true, save, notify panel
```

Each step is persisted; on service-worker wake, `chrome.storage.onChanged` / startup reads `sahayak_active_session_id` and `sahayak_sessions` → restores session → notifies panel (`agentSessionRestored`).

### 9.2 Page state builder

```ts
export async function buildPageState(tabId: number): Promise<PageState> {
  const [url, title] = await Promise.all([
    getTabUrl(tabId),
    getTabTitle(tabId),
  ]);
  const [elements, readability] = await Promise.all([
    scanElements(tabId),
    canSummarizeUrl(url) ? extractArticle(tabId) : null,
  ]);
  // Number elements 1..N (only those eligible for actions)
  const numbers = assignNumbers(elements);
  return { url, title, elements: numbers, readability, timestamp: Date.now() };
}
```

### 9.3 Prompt construction

Two families:

1. **Contextual prompts** (summarise, explain, translate, reply, chat): natural-language prompts with inserted content + language hint.
2. **Structured prompts** (find_it, agent_next_action): require JSON output with a schema + few-shot examples + safety constraints.

Language prompt suffix (Hinglish):

```
Respond in Hinglish (Hindi written in Roman script, natural mix with English terms).
```

Guardrails injected into every prompt:

- "Answer only from the provided page context. If the answer is not present, say 'I couldn't find this in the current page.' Do not invent details."
- "Return strict JSON, nothing else." (structured only)
- "Do not propose any action on banking, payment, login, password, OTP, or card fields."

### 9.4 Structured decision examples

**Find-it prompt (element selection):**

```
You control a browser with numbered interactive elements shown on screen.
Elements:
1) input#resume (file input)
2) button[type=submit] Upload Resume
3) select#role (Backend, Frontend, Full Stack)
4) input#linkedin (text input)
5) button[type=submit] Submit Application

Task: "Where do I upload my resume?"
Respond ONLY as JSON:
{
  "action": "find",
  "targetNumber": 1,
  "reason": "The file input for the resume is element 1 (input#resume)."
}
```

**Agent next-action prompt:**

```
Current goal: "Fill this internship application from my profile."
Current page state: { ... PageState (elements numbered 1..N) ... }
Profile: { name: "Anjali", college: "IIT Delhi", skills: ["React","Node"] }

Respond ONLY as strict JSON with this schema:
{
  "type": "click"|"type"|"select"|"scroll"|"done"|"none",
  "targetNumber": <int> | null,
  "value": <string> | null,
  "reason": "<one line>",
  "confidence": 0..1,
  "requiresExtraConfirm": true|false
}
Do not take multiple steps at once. Do not type into password/OTP/card fields.
```

### 9.5 Approval UI (`AgentPanel`)

For each proposed step, show:

- Step number + action type icon + target number + element label (e.g., "1. Click — 'Upload Resume' (file input)").
- `type` actions: show the value that would be typed (masked if sensitive-looking).
- Reason text.
- Map highlight: if `dryRunEnabled`, highlight the target without clicking; else show the badge.
- Buttons: **Approve**, **Skip**, **Dry-run** (if not active), **Stop**.
- Consequential actions: secondary confirmation modal with "I understand — this will Submit/Pay/Send."

Panel also shows a running progress bar: "Step 3 of 10", and a collapsible **Action Log** listing all steps with decisions.

### 9.6 Step limit & dry-run

- Default `stepLimit: 15`; shown to user; configurable in settings.
- If `steps.length >= stepLimit` and task not done → propose `done` with reason "Step limit reached. Review the action log and continue manually if needed."
- Dry-run: action marked `dryRun: true`, executes only highlight, no DOM mutation, step phase remains `propose` until user Approves.

### 9.7 Persistence & worker wake

```ts
// background startup
chrome.storage.local.get(['sahayak_active_session_id', 'sahayak_sessions'], (items) => {
  const sessionId = items.sahayak_active_session_id;
  if (sessionId && items.sahayak_sessions?.[sessionId] && !items.sahayak_sessions[sessionId].completed) {
    restoreSession(sessionId);
    panelMessage('agentSessionRestored');
  }
});

// on every state change
function persistSession(session: AgentSession) {
  sessions[session.id] = session;
  chrome.storage.local.set({
    sahayak_sessions: sessions,
    sahayak_active_session_id: session.running ? session.id : null,
  });
}
```

Use `chrome.storage.onChanged` listener to sync across windows/tabs and on worker wake.

---

## 10. Panel Architecture (React)

### 10.1 Tab navigation

Tabs (top tab bar):

1. **Summarize** — article / YouTube summary output.
2. **Chat** — grounded page chat with history + quick chips.
3. **Visual** — screenshot capture + visual questions.
4. **Agent** — agent goal input, approval cards, map, controls, log.
5. **Skills** — create/edit/export/import skills.
6. **Profile** — local profile editor.
7. **Settings** — API key, language, step limit, safety toggles.

### 10.2 Component responsibilities

| Component | Role |
|---|---|
| `TabNavigator` | switches visible panel section |
| `Chat` | sends `chatSend`, streams text, shows context warnings ("Not available on this page") |
| `SummarizePanel` | triggers `requestSummary` / `requestYouTubeSummary`, renders structured summary, language switcher |
| `ScreenshotPanel` | `screenshotCapture`, crop box (simple drag-to-crop overlay), ask question |
| `AgentPanel` | `agentStart` / `agentNextStep` / `agentDecide`, renders `ActionCard`, progress, controls, log |
| `SkillsPanel` | skill CRUD, export/import, template preview |
| `ProfilePanel` | profile CRUD, preview of auto-fill effect |
| `SettingsPanel` | API key (encrypted-ish: stored in chrome.storage.local, not hashed), language, limits |
| `ActionCard` | renders proposed action, reason, map highlight, approve/skip/dry-run/stop |
| `ErrorBanner` | displays `error` messages with retry actions |

### 10.3 Chat interface

- Message list (user / assistant) with history per active page.
- Input box + send; quick chips: "TL;DR", "Explain", "Translate to Hindi", "Draft reply".
- Grounding note: if answer from context → badge "Answered from this page". If absent → "I couldn't find this on the current page — I can't invent details."
- Stream responses when supported (`GeminiStreaming` → append text chunks).

### 10.4 Screenshot panel

1. Click **Capture Screen**.
2. Content script captures `captureVisibleTab` (PNG, quality 0.8).
3. Optional crop UI: overlay rectangle (implemented in content script + panel coordinate math) to focus on region.
4. Send image (base64) + question to vision model.
5. Show answer + source note.
6. Never store image beyond session.

### 10.5 Agent interface

- Goal input: "Find the backend internship application and apply filters for 'React' experience."
- Controls: step limit slider, dry-run toggle, Stop.
- Active session state: running / paused / completed.
- Action log: exportable (JSON/Markdown), collapsible, searchable.

### 10.6 Skills interface

- Create: name, category, prompt template with variables `{{selectedText}}`, `{{pageContent}}`, `{{pageUrl}}`, `{{timestamp}}`, `{{profile}}`.
- Trigger: from panel or context menu ("Use skill: Explain in Hinglish").
- Export/import: JSON file (profile + skills) — purely local transfer.

### 10.7 Settings

- API key input (stored locally, never sent anywhere except the chosen provider).
- Model tier preference (with warning: "stronger models may cost more").
- Default language.
- Step limit.
- Safety level (default: maximum).
- Clear all local data.

---

## 11. Feature Flow Details

### 11.1 Article summarisation flow

```
Panel "Summarize" → requestSummary
  → bg: isBlockedUrl(url) ? block locally : extractArticle(tabId)
  → buildText(textContent) → geminiChat { summary schema, language }
  → validate JSON → articleSummary → panel render
    { tldr, keyPoints[5], actions[3] }
Language: prompt suffix enforces English or Hinglish.
```

### 11.2 YouTube summarisation flow

```
Input URL in panel → requestYouTubeSummary
  → bg: youtube.extractYouTube(url) → validate public video
  → build transcript chunks (with optional chapter markers)
  → geminiChat → { tldr, keyPoints, chapters: [{label, seconds, snippet}], actions }
  → chapters rendered as clickable timestamp links: href = `#t=42s`
  → panel renders with language suffix
```

### 11.3 Page chat flow

```
User: "What is the application deadline?"
  → bg: pageState (readability textContent) + chatHistory
  → prompt: "Answer using ONLY the page context below..."
  → geminiChat
  → panel: shows answer + "Answered from this page" badge
  → if no answer: "I couldn't find this on the current page."
```

### 11.4 Context-menu actions

Registered in background:

```ts
chrome.contextMenus.create({ id: 'explain', title: 'Sahayak — Explain this', contexts: ['selection'] });
chrome.contextMenus.create({ id: 'translate', title: 'Sahayak — Translate to Hindi', contexts: ['selection'] });
chrome.contextMenus.create({ id: 'draftreply', title: 'Sahayak — Draft a reply', contexts: ['selection'] });
```

On click → background reads selected text → `geminiChat` with action-specific prompt → returns result → opens panel with output (or shows in a modal if panel closed).

### 11.5 Find-it + agent loop

Already covered in §9. The key contract: model returns **one** action in strict JSON; background validates; panel shows the single proposed step; user must Approve/Skip/Stop; only then does content execute.

### 11.6 Profile-driven form filling

```
Skill: "Fill this form from my profile"
  → bg: pageState + profile
  → prompt: "Fill fields using the profile below. Do not type passwords/OTP/card."
  → agent loop proposes type actions on matching fields (name matches by label/placeholder/selector)
  → user approves each type action
```

### 11.7 Export/import

```ts
export interface SahayakPackage {
  version: '1.0';
  profile: UserProfile;
  skills: SavedSkill[];
  exportedAt: number;
}
// export → JSON download; import → parse + merge into storage; invalid → error banner
```

---

## 12. Error Handling & Graceful Degradation

- **No API key** → settings banner: "Enter your Gemini API key to use Sahayak." Core read features disabled until provided.
- **429 rate limit** → retry with backoff + user notification.
- **Model error / invalid JSON** → request retry; max 2 retries; then show friendly "I'm having trouble understanding — please rephrase."
- **Element not found** → "That element is no longer on the page. Refreshing the map..."
- **Blocked page** → "This page type is restricted for safety reasons. You can still read and chat about it."
- **Service worker sleep** → everything persisted; session restored on wake; panel notified.
- **Unknown error** → `ErrorBanner` with `error.code` + human message + "Report" (local, no data sent).

Every failure must leave the agent in a recoverable state (paused, not crashed), with the action log intact.

---

## 13. Offline / On-device Considerations

Core requires an API key. On-device summarisation is **out of scope** for the 4-week build but the architecture is prepared:

- `model.ts` has a `provider === 'on-device'` branch reserved.
- Readability extraction is already local; structured summaries could later be produced by an on-device transformer for supported Chrome AI pages.

---

## 14. Security & Privacy

- API keys stored in `chrome.storage.local` only; never committed; never logged.
- No telemetry, no analytics, no network calls except direct API provider calls (with user key).
- Sensitive pages/content: not sent to free-tier; blocked pages never sent at all.
- Screenshot: local only, transient.
- Profile & skills: local only; export only when user downloads.
- No credentials in URL, logs, or error messages.
- Git: `.env` never committed; use example `.env.example`.

---

## 15. Non-Functional Requirements Mapping

| NFR | Implementation |
|---|---|
| Reliability | JSON validation, schema validation, retry/backoff, graceful error states, persistence across worker sleep |
| Privacy | Local-only storage, no backend, privacy gating before external calls, transient screenshots |
| Safety | Code-enforced URL/field/action blocklists, consequential confirmation, kill switch, one-action-at-a-time |
| Cost | Flash-Lite default, Groq fallback for text, Flash/vision only when needed |
| Usability | Side-panel primary, quick chips, clear proposed-action cards, understandability-first error messages |
| Deterministic JSON | Zod schemas + extraction wrapper + retry policy |

---

## 16. Build & Distribution

### 16.1 Local development

```bash
npm install                      # vite, react, zod, readabil
npm run dev                      # HMR for panel; reload unpacked in chrome://extensions
```

Load unpacked: `chrome://extensions` → "Load unpacked" → `sahayak/`.

### 16.2 Production build

```bash
npm run build
# → dist/ with manifest + assets
# zip: dist/* → sahayak-v1.0.0.zip (for Load unpacked)
```

### 16.3 Repository layout

- `README.md`: install, setup, usage, features, safety, API key note.
- `.github/workflows/build.yml`: build + package ZIP on release.
- `release/`: auto-generated release ZIP.
- `docs/`: this `architecture.md`, prompt library, contribution guide.
- GitHub Pages landing: `gh-pages` branch with screenshots + install instructions.

### 16.4 `.gitignore`

```
.env
.env.local
node_modules/
dist/
*.log
.DS_Store
```

---

## 17. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Selector instability → badges misalign | High | Attribute-hash + nth fallback, recompute on scroll/resize, rebuild on mutation |
| Model returns invalid JSON | High | Regex extraction + schema validation + structured few-shot + 2 retries |
| Service worker sleeping mid-loop | Medium | Full persistence, wake restoration, `chrome.storage.onChanged` sync |
| Rate limits on free tier | Medium | Backoff, tier fallback, clear retry UI |
| Harmful action proposals | High | Code-enforced action allowlist + field protection + consequential confirmation + URL blocklist + one-action-at-a-time |
| Private pages sent to free model | High | Privacy gating before every external call; user warning |
| React/app-forms not reacting to typed input | Medium | `dispatchInputEvents` (composition/input/selectionchange/change) |
| Side panel width limitations | Medium | Responsive panel CSS, collapsible sections, scrollable content |

---

## 18. Open Questions

1. Will the cohort allow `chrome.storage.sync` for cross-device profile sync? (Plan: `chrome.storage.local` only, per spec.)
2. Which exact practice sites will be used for Week 3 errands? (Confirm during build; add to a `PRACTICE_SITES` allowlist.)
3. Hinglish quality: decide whether to request Roman-script Hindi or Devanagari; plan: Roman-script by default (matches user expectation), swappable via language.
4. Does `captureVisibleTab` support the crop requirement? (Fallback: full capture + panel-side crop overlay.)

---

## 19. Appendix A — Example Prompt Templates

**Structured agent prompt template:**

```
You control a browser assistant. The user wants: "{{goal}}".

Current page state (interactive elements are numbered):
{{pageStateElements}}

{{readabilitySection}}
{{profileSection}}

Rules:
- Return EXACTLY one action in strict JSON.
- Schema: { "type": "click"|"type"|"select"|"scroll"|"done"|"none",
            "targetNumber": <integer|null>,
            "value": <string|null>,
            "reason": "<one line>",
            "confidence": <0-1>,
            "requiresExtraConfirm": <boolean> }
- Do NOT type into password, OTP, card, or confidential fields.
- Do NOT take more than one step at a time.
- If the task is complete, use type: "done" with reason: "Task complete."
```

**Page-chat prompt template:**

```
Answer the user's question using ONLY the content of the current page below.
If the answer is not present, say exactly: "I couldn't find this in the current page."
Do not invent facts, names, dates, or links.

Page content:
{{pageContent}}

User question: {{question}}

Respond in {{language}}.
```

---

*End of architecture.md.*