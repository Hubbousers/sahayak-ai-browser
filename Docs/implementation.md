# Sahayak — Phase-Wise Implementation Plan

**Version:** 1.0
**Based on:** `architecture.md` + `problem_statement.md`
**Goal:** Deliver a safe, installable Chrome Extension (Manifest V3, Side Panel) in **4 weeks**.
**Method:** Vertical slices per the recommended Cursor execution order. Each phase has a **"smallest working version"** definition — a version small enough to build and test within the phase, then expanded.

---

## Phase 0 — Preparation & Environment Setup (Half Day)

**Objective:** Establish the development environment and scaffolding before writing feature code.

### Deliverables
1. Git repository with `.gitignore` (excludes `node_modules/`, `dist/`, `.env`, logs).
2. Project structure matching `architecture.md`.
3. `package.json` with dependencies: `vite` (dev server for panel), `react`, `zod`, `readability`, `tailwindcss` (optional).
4. `tsconfig.json` resolving `src/shared` and `src/content`.
5. Example `.env.example` (never commit actual keys).

### Tasks
- Initialize repo; add `.gitignore`; add `README.md` skeleton.
- Scaffold directory tree: `public/`, `src/background/`, `src/content/`, `src/panel/`, `src/shared/`.
- Install dependencies.
- Create initial `manifest.json` (Phase 1).
- Write `src/shared/types.ts` (copy from architecture; it's the contract).
- Write `src/shared/storage.ts` (chrome.storage wrappers with typed accessors).
- Write `src/shared/constants.ts` (keys, error codes).

### Acceptance Criteria
- `npm run dev` runs a dev server serving `panel/index.html` with no errors.
- `npm run build` produces a `dist/` directory with all assets.
- Code compiles with zero TypeScript errors.

---

## Phase 1 — The Shell: Foundation & Settings (Week 1, Days 1–2)

**Objective:** Installable extension + side panel + settings, no AI calls yet.

### Deliverables
1. Working Manifest V3 extension loadable via "Load unpacked".
2. Side panel opens next to any webpage.
3. Settings screen for API key and basic preferences (language, step limit, model tier).

### Architecture Reference
- `manifest.json` (permissions: `activeTab`, `scripting`, `storage`, `tabs`, `contextMenus`, `sidePanel`, `clipboardWrite`, `host_permissions: <all_urls>`).
- `background/service_worker.ts`: side panel registration, messaging router, startup hooks.
- `panel/index.html` + `panel/index.tsx`: tab navigator shell, SettingsPanel.
- `src/shared/storage.ts`: `settingsStore`, `LANGUAGE_KEY`.

### Steps (Vertical Slice)

1. **Extension shell (no panel yet)**
   - Create `manifest.json`; `chrome://extensions` → Load unpacked.
   - Confirm background worker starts (log `console.log('Sahayak loaded')` to `chrome-extension://<id>/` → DevTools).

2. **Side panel**
   - Set `side_panel.default_path`.
   - Service worker registers: `chrome.sidePanel.open({ tabId })` and `setPanelBehavior`.
   - `panel/index.html` shows "Sahayak initialized".

3. **Tab navigator**
   - Implement 6 tabs (Summarize / Chat / Visual / Agent / Skills / Profile / Settings).
   - Only Settings functional for now.

4. **Settings storage**
   - API key field → save via `settingsStore`.
   - Language toggle (en/hi) → `LANGUAGE_KEY`.
   - Step limit & model tier → settings.
   - "Clear all data" button.

5. **Context menu registration**
   - Register `explain`, `translate`, `draft_reply` menu items (UI placeholder only).

### Acceptance Criteria (Phase 1)
- [ ] Extension loads without errors.
- [ ] Side panel opens via icon, command (`Ctrl+Shift+Y`), or tab right-click.
- [ ] API key is saved in `chrome.storage.local` and readable from DevTools (check `chrome.storage.local` in console).
- [ ] Language toggle persists across reloads.
- [ ] All tabs render; Settings data survives browser restart.
- [ ] Context menu items appear on text selection.

### Known Gaps (to be filled Phase 2+)
- No AI calls yet.
- No content script scanning.

---

## Phase 2 — First AI Interaction (Week 1, Days 3–4)

**Objective:** Real Gemini text call from the panel; selected-text explain.

### Deliverables
1. Working Gemini Flash-Lite API call from background.
2. "Explain this" on selected text works from right-click → result shows in panel.
3. API error state (429, invalid key) shows friendly messages.

### Architecture Reference
- `src/shared/model/geminiClient.ts` (wrapper around `fetch` to `https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`).
- `src/shared/model/orchestrate.ts` (routing + retry/backoff).
- `src/shared/json.ts` (JSON extraction + Zod validation).
- `panel/components/Chat.tsx` (basic message list).

### Steps

1. **Gemini client**
   - Implement `geminiChat(config, messages, options)`.
   - Test in `service_worker.ts` console with a hardcoded test prompt (later moved to settings key).
   - Test with a real API key from a `.env`-style variable read at runtime (never commit).

2. **Retry & error handling**
   - Handle HTTP 429/500/501 → exponential backoff, max 3 tries.
   - Show `ErrorBanner` in panel with code + retry button.

3. **Extract selected text**
   - Background reads `chrome.tabs.query` → content script `window.getSelection()` → returns text.
   - Alternative: `chrome.scripting.executeScript` with `args: () => getSelection()` (preferred for Manifest V3).

4. **Explain prompt**
   - Prompt: "Explain the following text in plain language. Keep it concise. Respond in {{language}}."
   - Insert selected text as `{{selectedText}}`.

5. **Panel chat UI**
   - `Chat.tsx`: user message bubble + assistant message bubble + streaming support.
   - "Explain this" → `contextMenu` → background → API → `panelMessage('contextActionResult')` → chat renders.

### Acceptance Criteria (Phase 2)
- [ ] API call succeeds with a valid key from Settings.
- [ ] Select text → right-click → "Sahayak — Explain this" → result appears in Chat tab.
- [ ] 429/timeout shows retryable error banner, no crash.
- [ ] Invalid API key → settings prompt, graceful.
- [ ] TypeScript compiles; no runtime exceptions logged in DevTools.

### Verification Pages
- Any plain-text page (news article, blog).
- Confirm output language matches Settings.

---

## Phase 3 — Article Summarisation (Week 1, Days 5–6)

**Objective:** Readability.js extraction → structured summary (TL;DR, 5 points, next steps).

### Deliverables
1. Readable article extraction excluding navigation/adverts/footers.
2. Structured summary in panel with required format.
3. English/Hinglish output switch.

### Architecture Reference
- `src/content/readability.ts` (Readability.js adapter).
- `panel/components/SummarizePanel.tsx`.
- Prompt templates in `src/tools/prompt-templates.ts`.

### Steps

1. **Readability integration**
   - Bundle Mozilla Readability.js via npm (`@mozilla/readability`) or external script.
   - `extractArticle(tabId)` → `{ title, byline, content (HTML), textContent, length }`.
   - Fallback if extraction fails (empty result) → show "I couldn't extract article text."

2. **Summary prompt**
   ```
   Summarize this article. Respond in {{language}}.
   Return EXACTLY JSON:
   {
     "tldr": "One-line summary",
     "keyPoints": ["point1", ..., "point5"],
     "actions": ["action1", "action2", "action3"]
   }
   ```

3. **JSON validation**
   - Zod schema: `SummarySchema`.
   - Extract via regex (`` ```json ... ``` ``) + fallback `JSON.parse`.
   - Retry once on invalid JSON.

4. **Panel rendering**
   - Render TL;DR (bold), key points (bulleted), "What to do next" (numbered).
   - Show "Extracted from: {{title}}".

5. **Hinglish suffix**
   - Prompt: "Respond in Hinglish (Hindi in Roman script mixed with English terms)."
   - Test: summary of Indian news article → Hinglish output.

### Acceptance Criteria (Phase 3)
- [ ] Normal article → structured summary with TL;DR, 5 key points, 3 action items.
- [ ] Navigation/navbars/ads excluded (verify by checking raw extracted content).
- [ ] English ↔ Hinglish toggle changes output language correctly.
- [ ] Fallback pages (e.g., single-page apps without text) show graceful message.

### Verification Pages
- News article (e.g., BBC, Reuters).
- Blog post (e.g., Medium clone).
- Page with heavy nav/footer (verify extraction quality).

---

## Phase 4 — Public YouTube Summarisation (Week 1, Day 7)

**Objective:** Public YouTube URL → chapter-style summary with clickable timestamps.

### Deliverables
1. YouTube URL parser; public-only enforcement.
2. Transcript extraction (auto-generated only).
3. Structured summary with chapters and `#t=` timestamp links.
4. Private/unavailable videos → graceful message.

### Architecture Reference
- `src/shared/youtube.ts`.
- `panel/components/SummarizePanel.tsx` (YouTube input mode).

### Steps

1. **URL parsing**
   - Extract video ID from `youtube.com/watch?v=` and `youtu.be/`.
   - Reject private/unlisted/private-by-username URLs → error banner.

2. **Transcript fetch**
   - Use `https://www.youtube.com/api/timedtext?v=...&lang=en&fmt=json3` (auto-generated tracks) or public VTT.
   - Fallback: title + description + channel only (with note "Full transcript unavailable").

3. **Summary prompt**
   ```
   Summarize this YouTube transcript. Respond in {{language}}.
   Return EXACTLY JSON:
   {
     "tldr": "One-line summary",
     "keyPoints": [...],
     "chapters": [ { "label": "...", "seconds": 42, "snippet": "..." } ],
     "actions": [...]
   }
   ```

4. **Render with timestamps**
   - Chapters → `[label](url#t=42s)`.
   - If no chapters → "No chapters available."

### Acceptance Criteria (Phase 4)
- [ ] Public video → summary with TL;DR, key points, chapters.
- [ ] Chapters are clickable and jump to correct timestamps.
- [ ] Private video → "Unsupported or private YouTube link."
- [ ] Missing transcript → graceful fallback message (not an error).

### Verification
- A public YouTube video with auto-generated captions.
- Confirm timestamp links work (`#t=42s`).

---

## Phase 5 — Grounded Page Chat (Week 2, Days 1–3)

**Objective:** Chat with current page; answer only from page context; grounding warnings.

### Deliverables
1. Chat interface with page context (readability textContent).
2. Grounding: "I couldn't find this in the current page" when absent.
3. Conversation history per active page.
4. Streaming responses (if supported).

### Architecture Reference
- `panel/components/Chat.tsx` (history + streaming).
- `src/shared/model/orchestrate.ts` (chat intent routing).
- `src/tools/prompt-templates.ts` (page-chat prompt).

### Steps

1. **Page state for chat**
   - `buildPageState(tabId)` → includes `readability.textContent`.
   - Inject into prompt: `Page content: {{pageContent}}`.

2. **Grounding prompt**
   ```
   Answer using ONLY the page content below. If absent: "I couldn't find this in the current page."
   Do not invent facts.
   Page content: {{pageContent}}
   User: {{question}}
   ```

3. **History management**
   - Store messages in `chrome.storage.local` keyed by `tabId` (or session).
   - On tab change, clear or save history per page.

4. **Streaming**
   - If Gemini supports streaming, append chunks to `Chat.tsx` state.
   - Fallback: render full response at once.

5. **Context chips**
   - "Explain", "Translate to Hindi", "Draft reply" quick actions from chat input.

### Acceptance Criteria (Phase 5)
- [x] Ask question about article → answer grounded in article.
- [x] Ask question NOT on page → "I couldn't find this in the current page." (no hallucination)
- [x] Conversation history persists during session.
- [x] Streaming shows text incrementally.
- [x] Follow-up questions reference prior context (conversation coherence).

### Verification
- Ask factual questions only answerable from the page.
- Ask unrelated question → confirm grounding message.
###  Phase 5 is implemented successfully.
---

## Phase 6 — Context Menu Actions (Week 2, Days 4–5)

**Objective:** Right-click actions for selected text: Explain, Translate, Draft reply.

### Deliverables
1. Three context menu items registered.
2. Translate to Hindi + Draft reply prompts.
3. Results open in side panel (Chat tab).

### Architecture Reference
- `background/service_worker.ts` (context menu click handler).
- `src/tools/prompt-templates.ts` (translate + reply templates).
- `src/shared/types.ts` (`contextMenu` message type).

### Steps

1. **Register menu items** (Phase 1 scaffold) → wire in Phase 6.
   - `explain`, `translate`, `draft_reply`.

2. **Translate prompt**
   ```
   Translate the following to Hindi. Keep tone professional.
   {{selectedText}}
   Respond in {{language}}.
   ```

3. **Draft reply prompt**
   ```
   Draft a polite reply to this message. Context: {{context}}.
   Use my profile if relevant: {{profile}}
   Respond in {{language}}.
   ```

4. **Content reading**
   - Use `chrome.scripting.executeScript` to get `window.getSelection().toString()`.

5. **Output rendering**
   - `contextActionResult` → Chat tab shows result + "Action: Translate" tag.

### Acceptance Criteria (Phase 6)
- [x] Select text → right-click → all three actions appear.
- [x] "Translate" → Hindi output in panel.
- [x] "Draft a reply" → contextual reply in panel.
- [x] "Explain this" → plain-language output.
- [x] Works on any page with selected text.

---

## Phase 7 — Screenshot & Visual Understanding (Week 2, Days 6–7)

**Objective:** Capture visible tab + crop + ask question about visual content.

### Deliverables
1. Screenshot capture via `chrome.tabs.captureVisibleTab`.
2. Optional crop UI to focus on region.
3. Vision model call (Gemini Flash) with image + question.
4. Result in Visual tab.

### Architecture Reference
- `src/content/overlay.ts` (crop overlay).
- `panel/components/ScreenshotPanel.tsx`.
- `src/shared/model/geminiClient.ts` (image support).

### Steps

1. **Capture**
   - `chrome.tabs.captureVisibleTab(tabId, { format: 'png', quality: 0.8 })` → data URL.
   - Send to panel → display in `ScreenshotPanel`.

2. **Crop (optional but recommended)**
   - Content script draws overlay rectangle; panel sends crop coordinates → content script crops canvas → base64.
   - Fallback: full screenshot if crop unsupported.

3. **Vision prompt**
   ```
   Analyze this screenshot. Answer the question using only visible content.
   Question: {{question}}
   If not visible: "I couldn't see that in the screenshot."
   ```

4. **Privacy gating**
   - Before sending: `isBlockedUrl(url)` → if blocked, refuse + explain.

### Acceptance Criteria (Phase 7)
- [x] Capture button → screenshot appears in panel.
- [x] Crop UI works (rect selection → cropped image sent).
- [x] Question about chart/error message/form → correct answer.
- [x] Blocked page → "This page type is restricted." (no screenshot sent)
- [x] No image stored after session.
###  Phase 7 is implemented successfully.

---

## Phase 8 — API Resilience & Fallback Logic (Week 2, Day 8)

**Objective:** Graceful failure across all AI calls; tiered model routing.

### Deliverables
1. Unified `generateText(intent)` with tier selection.
2. Retry/backoff for 429/500/503.
3. Groq fallback for eligible text tasks.
4. Switch to stronger model only on difficulty.

### Architecture Reference
- `src/shared/model/orchestrate.ts` (full implementation).
- `src/shared/model/groqClient.ts`.

### Steps

1. **Tier routing**
   - Lite default; Vision for images; Standard for complex reasoning; Groq fallback.

2. **Retry policy**
   - 429 → `retryAfter` header or exponential backoff.
   - 500/503 → backoff.
   - Log attempts to `ErrorBanner`.

3. **Fallback chain**
   - Gemini → 429 → Groq → error banner.

4. **Unit tests**
   - Mock 429 response → confirm retry.
   - Mock invalid JSON → confirm extraction + retry.

### Acceptance Criteria (Phase 8)
- [x] 429 → retry UI shows "retrying..." + countdown.
- [x] Gemini fail → Groq fallback (if configured).
- [x] Invalid JSON from model → retry once, then friendly error.
- [x] All error states display without crash.

### Verification
- Simulate rate limit (mock server or real 429).
- Confirm recovery path.
###  Phase 8 is implemented successfully.

---

## Phase 9 — Interactive Element Scanner & Badges (Week 3, Days 1–2)

**Objective:** Detect interactive elements, assign stable numbers, render badges.

### Deliverables
1. Content script scanner for buttons/links/inputs/textarea/select/checkbox/radio.
2. Numbered badges overlay.
3. Stable selectors (attribute hash + nth fallback).

### Architecture Reference
- `src/content/scanner.ts`.
- `src/content/overlay.ts`.
- `src/shared/types.ts` (`DetectedElement`).

### Steps

1. **Scanner**
   - Query selectors for all target element types.
   - Extract label (aria-label / alt / textContent / name / placeholder).
   - Compute stable selector.

2. **Numbering**
   - `assignNumbers()` → 1..N, only eligible-for-action elements.
   - Store map in `window.Sahayak.elements` (content script global, dev-only).

3. **Overlay**
   - Badge positioned absolute via `getBoundingClientRect()`.
   - Handle scroll/resize recompute (throttled).

4. **Cleanup**
   - `removeBadges()` called on tab change, agent stop.

### Acceptance Criteria (Phase 9)
- [x] Badge numbers visible over interactive elements on a form page.
- [x] Numbers stay stable across modest DOM changes (verify by adding/removing non-target elements).
- [x] Non-interactive elements not numbered.
- [x] Badges don't obstruct page usage.
###  Phase 9 is implemented successfully.

### Verification Pages
- Practice form (multi-step).
- E-commerce shop page.
- Forum/thread page.

---

## Phase 10 — Structured Element Selection (Find It) (Week 3, Days 3–4)

**Objective:** Natural-language request → correct numbered element; strict JSON.

### Deliverables
1. `find_it` intent → model returns `{ type: 'find', targetNumber, reason }`.
2. Schema validation via Zod.
3. Highlight target element (no action).

### Architecture Reference
- `src/tools/prompt-templates.ts` (find_it prompt).
- `src/shared/json.ts` (AgentActionSchema).

### Steps

1. **Prompt**
   ```
   The user asks: "{{question}}"
   Elements: {{elements}}
   Return ONLY JSON: { "type": "find", "targetNumber": <int>, "reason": "<line>" }
   ```

2. **Highlight**
   - If `type === 'find'` → call `highlightElement(targetNumber)` in content script (highlight border only, no click).
   - Panel shows "Element N: {{label}}" + reason.

3. **Validation**
   - Zod `AgentActionSchema` → `type` must be `'find'`; `targetNumber` within range.

### Acceptance Criteria (Phase 10)
- [x] "Where do I upload my resume?" → highlights the resume file input.
- [x] JSON strictly validated; invalid → retry message.
- [x] Multiple similar elements → correct one chosen (verify by testing).
- [x] Element not present → reason states "not found."
###  Phase 10 is implemented successfully.

---

## Phase 11 — Approval-Based Agent Loop (Week 3, Days 5–7)

**Objective:** One-step-at-a-time agent; user approval before every action; strict JSON.

### Deliverables
1. `AgentSession` persisted state.
2. Loop: read → build action map → model.nextAction → validate → approve → execute → repeat.
3. Supported actions: click, type, select, scroll, done.
4. `AgentPanel` approval UI.

### Architecture Reference
- `background/service_worker.ts` (agent orchestrator).
- `src/content/actions.ts` (execution).
- `panel/components/AgentPanel.tsx`, `ActionCard.tsx`.
- `src/shared/types.ts` (`AgentSession`, `AgentStep`).

### Steps

1. **Orchestrator**
   ```ts
   async function agentLoop(sessionId) {
     const session = sessions[sessionId];
     if (!session.running) return;
     const pageState = await buildPageState(session.tabId);
     const action = await model.nextAction({ goal: session.goal, pageState, profile });
     const validated = AgentActionSchema.parse(action);
     session.steps.push({ phase: 'propose', action: validated, ... });
     persistSession(sessionId);
     panelMessage('agentNewProposal', step);
     if (validated.type === 'done') { complete; return; }
     // wait for user decision via panelMessage listener
   }
   ```

2. **Execution**
   - `executeAction(tabId, action, dryRun)` → content script.
   - `type` uses `dispatchInputEvents` (composition/input/change).
   - Safety re-check before execution (password/OTP/card).

3. **Approval UI**
   - ActionCard shows: type + target + value (masked) + reason.
   - Buttons: Approve, Skip, Dry-run, Stop.
   - Consequential confirmation modal.

4. **Loop continuation**
   - On Approve + success → refreshPageState → loop.
   - On failed execution → step phase 'failed' → ask user to continue.

### Acceptance Criteria (Phase 11)
- [x] Agent proposes one action at a time.
- [x] No action executes before user clicks Approve.
- [x] Skip does not execute.
- [x] Stop cancels loop; log preserved.
- [x] Type action fills a form field correctly (verify in DevTools).
- [x] Scroll works up/down.
###  Phase 11 is implemented successfully.

---

## Phase 12 — Agent Controls, Persistence & Logs (Week 3, Day 8)

**Objective:** Step limit, dry-run, worker sleep survival, action log.

### Deliverables
1. Step limit (default 15) + Stop button.
2. Dry-run mode (highlight only).
3. Persistence across service-worker sleep.
4. Action log (proposed, executed, decisions).

### Architecture Reference
- `src/shared/storage.ts` (sessionsStore, ACTIVE_KEY).
- `panel/components/AgentPanel.tsx` (progress bar, log).
- `background/service_worker.ts` (worker wake restoration).

### Steps

1. **Step limit**
   - If `steps.length >= stepLimit` → propose `done` with reason.
   - Settings → configurable step limit.

2. **Dry-run**
   - Toggle in panel header.
   - `executeAction(..., dryRun: true)` → highlight only, no mutation.
   - Step phase stays 'propose' until approved.

3. **Persistence**
   - Save session on every mutation (approve/skip/stop/execute).
   - Worker wake → restore `active_session_id` → notify panel.
   - `chrome.storage.onChanged` listener for cross-tab sync.

4. **Action log**
   - Render per-step: action, reason, decision, timestamp, status.
   - Export to JSON/Markdown.

### Acceptance Criteria (Phase 12)
- [x] Step limit enforced (agent stops proposing after limit).
- [x] Dry-run highlights without acting.
- [x] Close browser → reopen → agent session restored, prompt continues.
- [x] Log shows all proposed + executed steps with decisions.
- [x] Log exportable.

#### Phase 12 Validation Notes & Findings:
- **Step limit enforcement**: Verified in src/background/service_worker.ts (proposeNextStep) where a step limit check stops action generation and proposes a terminal done action once session.steps.length >= session.stepLimit, accompanied by a visual step count and progress bar in AgentPanel.tsx.
- **Dry-run mode**: Verified. The dryRun toggle flags actions so executeAction triggers element highlights/scrolling without mutating DOM input or firing click submissions.
- **Worker wake & cross-tab sync**: Audited and hardened in src/background/service_worker.ts: active sessions restore cleanly upon service worker awakening (restoreActiveSessionOnWake), and storage change listeners sync active agent state across tabs and panel instances.
- **Log display & export**: Complete and operational in AgentPanel.tsx, allowing full session inspection (timestamp, proposed actions, reasons, user decisions) and export to JSON or Markdown.

###  Phase 12 is implemented successfully.

---

## Phase 13 — Practice Tasks (Week 4, Days 1–2)

**Objective:** Complete 2+ controlled practice errands end-to-end with approvals.

### Deliverables
1. Practice form fill (multi-step internship application) from instruction.
2. Shop search + filter application.
3. Multi-page info collection (table).

### Architecture Reference
- `src/shared/types.ts` (practice tasks).
- Verified on pre-selected practice sites (add to allowlist).

### Steps

1. **Practice form**
   - Instruction: "Fill the backend internship form with my profile."
   - Agent proposes type actions on name/email/skills → user approves each.

2. **Shop search**
   - Instruction: "Search 'laptop' and filter to price < 50000."
   - Agent: type in search box → click search → select price filter → click apply.

3. **Multi-page table**
   - Instruction: "Collect product names and prices from page 1 and 2 into a table."
   - Agent: click next → collect.

4. **Safety checks**
   - Confirm no writes to password/OTP/card fields.
   - Confirm consequential actions require confirmation.

### Acceptance Criteria (Phase 13)
- [x] Two practice errands completed end-to-end with approval at every step.
- [x] Final output verified (form filled, filters applied, table collected).
- [x] All actions logged.
- [x] Agent stopped cleanly on user request mid-task.
###  Phase 13 is implemented successfully.

---

## Phase 14 — Local Profile Memory (Week 4, Days 3–4)

**Objective:** User profile stored locally; used for form filling + drafts.

### Deliverables
1. Profile form (name, college, skills, links, tone, language).
2. Profile injected into prompts when relevant.
3. Export/import profile + skills file.

### Architecture Reference
- `src/shared/types.ts` (`UserProfile`, `SavedSkill`).
- `src/shared/storage.ts` (profileStore, skillsStore).
- `panel/components/ProfilePanel.tsx`, `SkillsPanel.tsx`.

### Steps

1. **Profile storage**
   - `UserProfile` CRUD → `chrome.storage.local`.
   - ProfilePanel validates inputs.

2. **Profile injection**
   - Prompt: `Use my profile if relevant: {{profile}}`.
   - Apply when drafting replies / filling forms.

3. **Export/Import**
   - Export → JSON download (profile + skills + settings).
   - Import → parse + merge; invalid → error.

### Acceptance Criteria (Phase 14)
- [x] Profile saved locally; persists across restarts.
- [x] Draft reply uses profile name/tone.
- [x] Form fill uses profile fields.
- [x] Export → file downloads.
- [x] Import → data restored correctly.

#### Files Modified / Created for Phase 14:
- src/panel/components/ProfilePanel.tsx (Created: User profile editor for name, college, skills, links, preferred tone & language with local storage sync).
- src/panel/components/SkillsPanel.tsx (Created: Prompt skills management with category badges, full CRUD, template interpolation, and package export/import).
- src/panel/index.tsx (Connected ProfilePanel and SkillsPanel into active tab switcher).
- src/background/service_worker.ts (Integrated profile injection into reply drafting prompts and agent prompt generation, and registered message handlers for profile and skills CRUD).

###  Phase 14 is implemented successfully.

---

## Phase 15 — Safety Rails (Week 4, Days 5–6)

**Objective:** Code-enforced safety rules (URL blocklist, field protection, consequential confirmation).

### Deliverables
1. `safety.ts`: URL blocklist, path patterns, field protection regex, consequential selector detection.
2. Agent mode disabled on blocked pages.
3. Consequential-action double confirmation.
4. Kill switch.

### Architecture Reference
- `src/shared/safety.ts` (full implementation).
- `background/service_worker.ts` (pre-call safety gates).
- `panel/components/AgentPanel.tsx` (kill switch).

### Steps

1. **URL blocklist**
   - Sensitive domains (banking, payment, UPI, login) → blocklist.
   - `isBlockedUrl(url)` called before every agent action + every external API call.

2. **Field protection**
   - Password / OTP / card regex → `isProtectedField(element)`.
   - Never propose `type` on protected fields → fail with reason.

3. **Consequential confirmation**
   - `isConsequential(element)` → Submit/Pay/Send/Confirm/Cancel.
   - Secondary modal: "This will Submit. Proceed?"

4. **Kill switch**
   - Visible `STOP` button in Agent header → stops loop, saves state.

5. **Test matrix**
   - Blocked URL → confirm agent mode off.
   - Password field → confirm blocked.
   - Submit button → confirm extra confirmation.

### Acceptance Criteria (Phase 15)
- [x] Banking page → agent mode disabled, safety message.
- [x] Password/OTP/card field → never written to.
- [x] Submit/Pay button → double confirmation required.
- [x] Kill switch stops active agent immediately.
- [x] Safety rules in code (not only prompts).

#### Files Modified / Created for Phase 15:
- src/shared/safety.ts (Hardened URL blocklist for banking/UPI/payment/login domains and paths, expanded regex for protected fields including card/OTP/password heuristics, and expanded consequential action detection regex).
- src/background/service_worker.ts (Enforced pre-call safety gates: blocked screenshots on sensitive pages, halted agent execution on restricted domains, and verified field protection before proposing type actions).
- src/panel/components/AgentPanel.tsx (Equipped with red secondary confirmation gate for consequential actions and dedicated Stop kill-switch).

###  Phase 15 is implemented successfully.

### Verification
- Create local mock sensitive pages (banking login, payment form, OTP form) in a local test HTML file served via `chrome-extension://` or `localhost` (for manual testing only).

---

## Phase 16 — Polish, Testing & Documentation (Week 4, Days 7–9)

**Objective:** Make project installable, documented, and shareable.

### Deliverables
1. `README.md` (install, setup, usage, features, safety, API key note).
2. `.github/workflows/build.yml` (build + release ZIP).
3. GitHub Release ZIP (installable via Load unpacked).
4. GitHub Pages landing page.
5. Screenshots in repo (`public/screenshots/`).

### Steps

1. **README**
   - Overview, features table, quick start, API key setup, safety notes, troubleshooting.

2. **CI build**
   - `npm run build` → `dist/`.
   - Package ZIP → upload as GitHub Release asset (manual or via `actions/upload-artifact`).

3. **Screenshots**
   - Capture side panel on each feature (summarize, chat, screenshot, agent, profile, skills, settings).

4. **Landing page** (GitHub Pages)
   - One page: header, features, quick install, screenshots, link to repo/release.

5. **End-to-end test**
   - Fresh install → enter API key → run complete workflow (FR-1 → FR-10).

### Acceptance Criteria (Phase 16)
- [x] New user can install from Release ZIP via Load unpacked.
- [x] README clear for non-expert.
- [x] API key never in repo (check .gitignore + search).
- [x] Landing page live.
- [x] Full workflow works (12 DoD items).

#### Files Modified / Created for Phase 16:
- README.md (Completely revamped with architecture details, quickstart options, configuration instructions, safety matrix, and project structure).
- .github/workflows/build.yml (Created GitHub Actions CI workflow to automate extension compilation, packaging into 
release/sahayak-extension.zip, and uploading build artifacts).
- docs/index.html (Created responsive GitHub Pages landing page with feature cards, quickstart installation guide, and links).
- sahayak-extension.zip (Generated production release ZIP containing the compiled dist/ bundle ready for Load unpacked in Chrome).
- .gitignore (Verified exclusion of .env, credentials, logs, and artifacts).

###  Phase 16 is implemented successfully.

---

## Phase Summary Table

| Phase | Weeks | Key Deliverables | Acceptance |
|---|---|---|---|
| 0 — Prep | 0.5 | Repo, structure, types, storage, tooling | `npm run dev` + `build` clean |
| 1 — Shell | W1-1-2 | Manifest, side panel, settings, context menus | Loads, opens panel, key stored |
| 2 — AI | W1-3-4 | Gemini client, retry, explain selected text | API call works, error banners |
| 3 — Article Sum | W1-5-6 | Readability, structured summary, en/hi | TL;DR + 5 points + 3 actions |
| 4 — YouTube | W1-7 | Transcript fetch, chapters, timestamps | Public video summary with links |
| 5 — Page Chat | W2-1-3 | Grounded chat, history, streaming | Grounded answers, no hallucination |
| 6 — Context Menu | W2-4-5 | Explain/Translate/Draft reply | Right-click → panel output |
| 7 — Screenshot | W2-6-7 | Capture, crop, vision question | Visual QA works |
| 8 — Resilience | W2-8 | Model routing, retry, fallback | 429/500 handled gracefully |
| 9 — Scanner | W3-1-2 | Elements + badges + stable selectors | Numbers over interactive elements |
| 10 — Find It | W3-3-4 | `find` intent, strict JSON, highlight | Correct element identified |
| 11 — Agent Loop | W3-5-7 | Session, approval UI, execute | One action, approval required |
| 12 — Controls | W3-8 | Step limit, dry-run, persistence, log | Session survives sleep |
| 13 — Practice | W4-1-2 | 2+ errands end-to-end | Form fill, shop filter, table |
| 14 — Profile | W4-3-4 | Local profile, export/import | Profile used in drafts/forms |
| 15 — Safety | W4-5-6 | Blocklist, field protection, confirmation, kill switch | Sensitive pages/fields blocked |
| 16 — Ship | W4-7-9 | README, CI, release ZIP, landing page | Installable, documented, live |

---

## Risk Mitigation Checklist

| Risk | Mitigation | Phase |
|---|---|---|
| Selector instability | Attribute-hash + nth fallback; recompute on scroll/resize | Phase 9 |
| Invalid model JSON | Regex extraction + Zod schema + retry | Phase 10, 11 |
| Worker sleep | Full persistence; restore on wake | Phase 12 |
| Rate limits | Backoff, tier fallback, UI | Phase 8 |
| Harmful actions | Code blocklist + field protection + double confirm | Phase 15 |
| Private pages leaked | Privacy gating before every API call | Phase 7, 15 |
| React-form typing | `dispatchInputEvents` (composition/input/change) | Phase 11 |
| Side panel width | Responsive CSS, collapsible sections | Throughout |

---

## Verification Matrix (Mapping Features → Phase)

| Feature (from FR) | Phase |
|---|---|
| FR-1 Side Panel | 1 |
| FR-2 Settings | 1 |
| FR-3 Content Extraction | 3 |
| FR-4 Summarisation (en/hi) | 3, 4 |
| FR-5 Grounded Page Chat | 5 |
| FR-6 Visual Understanding | 7 |
| FR-7 Structured JSON | 10, 11 |
| FR-8 Human Approval | 11, 12 |
| FR-9 Local Memory | 14 |
| FR-10 Safety in Code | 15 |

---

*This plan follows the "smallest working version first" approach. Each phase builds on verified earlier phases. Do not move to the next phase until the previous phase's acceptance criteria are met on real pages.*