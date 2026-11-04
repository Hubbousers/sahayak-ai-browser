# Sahayak — Edge Cases & Corner Scenario Document

**Version:** 1.0
**Based on:** `architecture.md` + `implementation-plan.md`
**Purpose:** A living list of corner scenarios that **must not crash the extension**, must be handled **gracefully**, and must **not compromise safety or user data**. Every scenario is tagged to the phase that introduces it, and marked with a severity (High / Medium / Low).

---

## 1. Severity Definitions

| Severity | Meaning | Required Behavior |
|---|---|---|
| **High** | Privacy, safety, security, or data loss. | **Never** allow the outcome. Code must block it. |
| **Medium** | Feature breaks or user workflow interrupted. | Fail gracefully, show human-readable message, no crash. |
| **Low** | Minor UX polish. | Handle politely or log; user can retry. |

---

## 2. Core Safety & Privacy Edge Cases (High)

These are non-negotiable. They are enforced in `safety.ts` and the agent loop.

### 2.1 Sensitive Page Access

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-01 | User opens agent on `https://*.bankofamerica.com/` | Agent mode disabled; safety banner: "This page type is restricted for safety reasons." | 15 |
| SC-02 | User pastes a payment/checkout URL (`/checkout`, `/payment`) | Blocked; page chat still allowed but no agent actions. | 15 |
| SC-03 | UPI / digital wallet domain (`paytm`, `phonepe`, `gopay`) | Blocked; no screenshot, no agent. | 15 |
| SC-04 | Login page (`*.login.*`, `/?login`, `auth/`) | Blocked; chat allowed with "I can't act on this page." | 15 |
| SC-05 | URL with query params that obfuscate a sensitive path (`/s3cur3-p4ym3nt?x=1`) | Regex-based path check catches keyword variants; if uncertain, block. | 15 |
| SC-06 | User tries to take a screenshot of a blocked page | Refuse with reason; do not capture. | 15 |
| SC-07 | Free-tier model (Groq) asked to process a sensitive page | Pre-call privacy gate blocks the external call; respond locally. | 15 |

### 2.2 Protected Field Access

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-08 | Agent proposed `type` action on `<input type="password">` | Action rejected; "I won't type into password fields." No execution. | 15 |
| SC-09 | OTP field (`name="otp"`, `placeholder="one-time code"`) | Blocked with reason. | 15 |
| SC-10 | Card fields (`cvv`, `card_number`, `expiry`, `pan`) | Blocked; safety message. | 15 |
| SC-11 | Hidden input with sensitive value attribute | Hidden fields excluded from scanning entirely. | 15 |
| SC-12 | Field name obfuscated (`name="p4ssw0rd"`, `data-otp="true"`) | Keyword detection on label + placeholder + aria too; if match, block. | 15 |
| SC-13 | Contenteditable div used as password field | Class-based heuristic (`class*="password"`, `role="password"`) blocks. | 15 |

### 2.3 Consequential Action Safety

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-14 | Agent proposes `click` on Submit/Pay/Cancel/Confirm/Delete | Secondary confirmation modal: "This will Submit. Proceed?" | 15 |
| SC-15 | User clicks Approve without reading the modal | Action still requires explicit second confirmation; modal must have focus. | 15 |
| SC-16 | Agent proposes `type` with value containing `;` or `\` | Sanitize value passed to execution; never treat as command. | 11 |
| SC-17 | Agent proposes `done` on a page with pending changes | Warning: "You may have unsaved changes on this page." | 12 |

### 2.4 API Key & Credential Safety

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-18 | User sets API key, then commits code to GitHub | `.gitignore` excludes `.env`; README warns never to commit. CI scans for `GOOGLE_API_KEY` patterns. | 16 |
| SC-19 | API key stored in `chrome.storage.local` is inspected via DevTools | Key visible in DevTools only (expected); never logged anywhere; never sent to analytics. | 1 |
| SC-20 | Two browser profiles each have different API keys | Keys scoped by profile; no cross-contamination. | 14 |

### 2.5 Screenshot Privacy

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-21 | Screenshot contains sensitive form data filled by user | Screenshot is **local only**, shown in panel, deleted from memory after answer delivered. | 15 |
| SC-22 | User cancels crop selection | No image sent; clean exit. | 7 |
| SC-23 | `captureVisibleTab` fails (tab not visible, extension page) | Error banner: "Can't capture this view. Focus the tab and try again." | 7 |

### 2.6 Data & Profile Security

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-24 | `chrome.storage.local` is wiped (clear site data) | Session restored as empty; agent stops gracefully with "Session lost; starting new task." | 12 |
| SC-25 | User imports an invalid / malicious JSON skills file | Validation with Zod; invalid → error banner; no execution of imported code. | 14 |
| SC-26 | Profile contains a skill with `{{execute}}` template | Templates are **text only**; no eval. Skill is stored as plain string. | 14 |
| SC-27 | Profile contains extreme input (10,000+ char name, nested arrays) | Truncate/sanitize on save; warn user. | 14 |

---

## 3. Chrome Extension Lifecycle Edge Cases (Medium / High)

### 3.1 Service Worker Sleep & Wake

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-28 | Background worker sleeps mid-agent-loop | Session persisted before sleep; on wake, `chrome.storage.onChanged` restores; panel notified. | 12 |
| SC-29 | Worker wakes but tab was closed | `chrome.tabs.query` detects tab missing → session cleared; panel shows "Tab closed; session ended." | 12 |
| SC-30 | Multiple tabs open with active agent sessions | Session keyed by `tabId`; each tab has own session; no cross-talk. | 12 |
| SC-31 | Extension reloaded (`chrome://extensions` refresh) | All sessions persisted; restored on restart. | 12 |
| SC-32 | Manifest updated while agent running | New manifest reload → sessions kept (local storage survives); agent asks user to restart. | 16 |

### 3.2 Side Panel Behavior

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-33 | User closes side panel while agent running | Session persisted; panel reopen restores; agent paused, waiting for next approval. | 12 |
| SC-34 | Side panel opens on an extension page (`chrome://extensions`) | Error: "Sahayak only works on normal web pages." | 1 |
| SC-35 | Side panel width set to minimum (200px) | All content collapses gracefully; no overflow; scrollable. | 16 |
| SC-36 | Side panel resized by user | React re-renders; agent cards adapt; badges still positioned on page. | 16 |
| SC-37 | Tab switches while panel open on different tab | Panel context updates; stale content cleared; agent paused. | 12 |

### 3.3 Tab & Navigation

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-38 | User navigates to new page while agent paused | Page state refreshed; agent asks "Continue or start new task?" | 12 |
| SC-39 | Tab is reloading (page refresh) mid-action | `beforeunload` handler persists state; after reload, session restored, user re-approves current step. | 12 |
| SC-40 | Tab is in background (not focused) | Agent can still propose; approval requires focus; badge overlay still works. | 12 |
| SC-41 | `chrome.tabs.captureVisibleTab` called when tab is background | Fails gracefully → error banner. | 7 |
| SC-42 | Tab type is `type_bookmarklist`, `type_history`, `type_hangouts` | Message: "Sahayak only works on normal web pages." | 9 |

### 3.4 Content Script Injection

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-43 | Page is a Web Worker or iframed content | Content script does not inject into `all_frames`; handle frame-less gracefully. | 9 |
| SC-44 | Page blocks content script (`Content-Security-Policy: default-src 'self'`) | Error banner: "This page doesn't allow assistant features." | 9 |
| SC-45 | Page is a Chrome App or sandboxed page | Detect and refuse with message. | 9 |
| SC-46 | Content script fails to inject (page already loaded, error) | Background retries injection once; if fails, panel shows error. | 9 |
| SC-47 | Page uses `sandbox` attribute on `<iframe>` | Skip iframe; only top-level frame scanned. | 9 |

### 3.5 Scripting Permissions

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-48 | `executeScript` rejected due to missing permission | Manifest declares `scripting`; if still rejected, error banner. | 2 |
| SC-49 | `storage` access denied (private instance) | Detect and warn. | 1 |

---

## 4. AI Model & Prompt Edge Cases (Medium)

### 4.1 JSON Strictness

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-50 | Model returns Markdown code fences (`` ```json ... ``` ``) | Regex extraction handles fences. | 10 |
| SC-51 | Model returns extra prose around JSON | Regex finds first `{...}` block; if multiple, take first valid. | 10 |
| SC-52 | Model returns invalid JSON (trailing comma, single quotes) | `extractJson` fails → retry once with re-prompt. | 10 |
| SC-53 | Model returns 3rd retry with invalid JSON | Panel message: "I couldn't understand my instructions. Please rephrase your task." | 10 |
| SC-54 | Model returns `null` or empty string | Validate schema → treat as no action; ask user to rephrase. | 11 |
| SC-55 | Model returns `targetNumber: 999` (out of range) | Zod validation fails → request re-try with valid number. | 10 |
| SC-56 | Model returns action type not in allowlist (`navigate`, `delete`) | Zod `z.enum` fails → safety reject; never execute. | 11 |
| SC-57 | Model forgets `requiresExtraConfirm` on Pay button | Default `false` in schema → safety layer recomputes `isConsequential` independently (code, not prompt). | 15 |
| SC-58 | Model returns `reason` longer than 160 chars | Trim + warn; store truncated. | 10 |

### 4.2 Rate Limits & Errors

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-59 | HTTP 429 on first call | Retry UI shows "Model busy... retrying in Xs" + countdown. | 8 |
| SC-60 | 429 persists after 3 retries | Fallback to Groq (if configured) → if Groq also 429 → "All models busy; try again later." | 8 |
| SC-61 | HTTP 500/502/503 from Gemini | Exponential backoff → Groq fallback. | 8 |
| SC-62 | Invalid API key (HTTP 401) | Settings banner: "Invalid API key. Please check your settings." No further calls. | 2 |
| SC-63 | No network (offline) | Immediate error: "No internet connection. Check your network." | 8 |
| SC-64 | Response truncated mid-stream | Stream buffer incomplete → wait for next chunk; if timeout, use partial answer. | 5 |
| SC-65 | Model times out (no response) | Timeout after 60s → retry once → error banner. | 8 |
| SC-66 | Gemini quota exhausted (paid tier) | Message: "Quota exhausted. Check your billing." | 8 |

### 4.3 Model Behavior & Grounding

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-67 | User asks a question not answerable from page | "I couldn't find this in the current page." (grounding guard) | 5 |
| SC-68 | Page content is 0 characters (SPA, JS-rendered) | "This page has no extractable text. Try taking a screenshot." | 3 |
| SC-69 | Readability fails to parse (malformed HTML) | Fallback to `textContent` of whole page; if still fails → error. | 3 |
| SC-70 | Article has no clear structure (blog with no header) | Summary still produced; `tldr` may be generic → user warned. | 3 |
| SC-71 | YouTube video has no auto-generated captions | "Full transcript unavailable. Summarizing from title and description." | 4 |
| SC-72 | YouTube video duration > 1 hour (transcript too long) | Chunk transcript; summary still produced; chapters limited to top 10. | 4 |
| SC-73 | Model ignores "one action at a time" rule (returns 3 actions) | Parser takes only the first action; warn user. | 11 |
| SC-74 | Model returns a `type: 'scroll'` without `direction` | Schema requires `direction` for scroll → validation fail → retry. | 11 |
| SC-75 | Model hallucinates a `targetNumber` that doesn't exist | Execution → element not found → step marked failed; user offered to continue. | 11 |

---

## 5. DOM & Selector Edge Cases (Medium)

### 5.1 Element Detection Stability

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-76 | Badge number 5 is a `<button>` inside a dynamic list that grows to 6 items | Numbers re-assigned on refresh; overlay repositions. | 9 |
| SC-77 | Element removed after numbering (AJAX load) | Agent handles "Target element no longer exists" on execution. | 11 |
| SC-78 | Two elements have identical labels ("Submit" twice) | `isConsequential` requires double confirm for **both**; user sees both badges; can choose either. | 15 |
| SC-79 | Element has no label / text (icon button) | Label derived from `aria-label`, `title`, `alt`, or selector → if none, "Unnamed icon button". | 9 |
| SC-80 | Button is a CSS-only fake (div styled as button) | Detected via `role="button"` / `tabindex="0"` / click handler; if missed, user warned. | 9 |
| SC-81 | Select dropdown with 200 options | Only visible subset queried; scroll handles rest. | 9 |
| SC-82 | `<input>` of type `file` | Detected but **not** typeable (can't set file path from security); flagged as special. | 9, 15 |
| SC-83 | Checkbox inside a shadow DOM | Shadow DOM elements **not** reachable by scanner → user warned ("Some elements may be hidden"). | 9 |
| SC-84 | Element inside a `<frame>` or `<iframe>` | Only top-level scanned; iframe content inaccessible (security). | 9 |
| SC-85 | Malformed HTML breaks `querySelector` (e.g., unclosed `<div>` everywhere) | Readability + scanner use defensive selectors; wrap in try/catch; continue. | 3, 9 |

### 5.2 Overlay / Badge Behavior

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-86 | Page has 60 interactive elements → 60 badges | Badges scale; if overflow, show numbered map instead of overlay; badges remain readable. | 9 |
| SC-87 | Badge covers a small mobile-sized button (on responsive desktop) | Badge positioned top-right of element; may overlap adjacent element → user warned via map. | 9 |
| SC-88 | Scrollbar present → badge positioned partially off-screen | Badge position clamped to viewport; highlight box still drawn. | 9 |
| SC-89 | User zooms page (Ctrl +/-) | Badge repositioned on `resize`; stale positions recomputed. | 9 |
| SC-90 | Multiple scrollable containers in page (nested overflow) | Only top-level `window` scroll captured; nested scroll may misalign → user warned. | 9 |
| SC-91 | Element moves while badge displayed | MutationObserver → rebuild map on significant DOM change. | 9 |

---

## 6. Language & Translation Edge Cases (Low / Medium)

### 6.1 English / Hinglish Toggle

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-92 | User switches language mid-chat | Existing messages unchanged; new messages use new language. | 5 |
| SC-93 | Hinglish output contains Devanagari by accident | Force Roman script via prompt suffix; validate output; if Devanagari detected → re-prompt. | 3 |
| SC-94 | Source content is already Hindi (not Hinglish) | Translate/Explain to Hinglish converts Devanagari to Roman. | 6 |
| SC-95 | Language setting not saved after restart | Settings persist in `chrome.storage.local`; verify on reload. | 1 |
| SC-96 | Prompt template missing `{{language}}` placeholder | Template validator checks all placeholders exist; warn on build. | 2 |

---

## 7. Context Menu & Selection Edge Cases (Medium)

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-97 | Right-click inside an iframe | Context menu registered only for top-level window selection. | 6 |
| SC-98 | No text selected (empty selection) | Context menu shows but action disabled → "Select text first." | 6 |
| SC-99 | Selected text is a password field (user selects it) | Explain/Translate allowed; Draft reply allowed; **never** type. | 6 |
| SC-100 | Context menu clicked on a page where content script failed | Menu item shows but action → error banner ("Feature unavailable on this page"). | 9 |
| SC-101 | User selects an image (not text) | "Please select text, not an image." | 6 |

---

## 8. Screenshot Edge Cases (Medium)

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-102 | Cropped region is 0 width/height | Validation: "Select a region to analyze." | 7 |
| SC-103 | Screenshot is very large (>10MB) | Compress to quality 0.6; warn "Image compressed for performance." | 7 |
| SC-104 | Vision model rejects image (too large, unsupported format) | Error: "Image too large. Try cropping to a smaller area." | 7 |
| SC-105 | Screenshot contains a CAPTCHA | Model may refuse; user warned "I can't solve CAPTCHAs." | 7 |
| SC-106 | Screenshot of a blank/white page | "I can't see anything on this page. Refresh and try again." | 7 |

---

## 9. Agent Loop Edge Cases (Medium)

### 9.1 Step Execution

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-107 | `click` on a disabled button (`disabled=true`) | Execution fails → step marked failed → user offered to continue. | 11 |
| SC-108 | `type` into a read-only field | Fails → reason: "Field is read-only." | 11 |
| SC-109 | `type` value contains a newline `\n` | Sent as-is to input (valid) → but if contains control chars, sanitize. | 11 |
| SC-110 | `select` value not in the dropdown's options | Validate `value` against `element.options` → if missing, retry model. | 11 |
| SC-111 | `scroll` direction invalid (`left`) | Schema enum rejects; retry. | 11 |
| SC-112 | Action executed but page doesn't change (AJAX no re-render) | `refreshPageState` re-scans; if state unchanged, user warned. | 12 |
| SC-113 | Execution throws exception (e.g., element disappeared mid-click) | Try/catch → step `failed` → user offered to continue or restart. | 11 |
| SC-114 | Page navigates away mid-action (click triggers redirect) | Session paused; on reload, user asked "Continue or restart?" | 12 |
| SC-115 | `done` action proposed but goal still incomplete | User warned: "Are you sure the task is done?" | 11 |

### 9.2 Session & State

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-116 | Step limit (15) reached before `done` | Propose `done` with reason: "Step limit reached." User can still approve. | 12 |
| SC-117 | User clicks Approve then immediately Stop | Stop takes priority; current step skipped. | 12 |
| SC-118 | Agent session JSON corrupted in storage | On load → catch parse error → start fresh session; log warning. | 12 |
| SC-119 | Session has 500+ steps (user never stops) | Log export trims to last 100 for display; full stored. | 12 |
| SC-120 | Two users approve the same step in parallel (multi-tab) | Session keyed by tab; each tab its own approval; no race. | 12 |
| SC-121 | User closes tab mid-approval modal open | Modal discarded; session persisted as paused. | 12 |

---

## 10. Skills & Profile Edge Cases (Medium)

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-122 | Skill template references `{{unknownVar}}` | Template validator warns on save; placeholder left literal in output. | 14 |
| SC-123 | Skill with no prompt template (empty) | Validation: "A skill needs a prompt." Save blocked. | 14 |
| SC-124 | Import file larger than 1MB | Reject: "File too large." | 14 |
| SC-125 | Import file with valid JSON but wrong schema | Zod validation → "Invalid skills file format." | 14 |
| SC-126 | Import merges with existing skills → duplicate IDs | Import dedupes by ID; duplicates show warning. | 14 |
| SC-127 | Profile `preferredTone` set to unsupported value | Dropdown restricts to `formal/friendly/plain`; if imported bad value → default. | 14 |
| SC-128 | Skill executes on a blocked page | Safety gate overrides skill; "This page is restricted." | 15 |
| SC-129 | Skill prompt contains HTML tags | Sanitize before injection; render as text. | 14 |

---

## 11. UI / Usability Edge Cases (Low)

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-130 | Panel has no height to show long response | Scrollable content area; no horizontal overflow. | 16 |
| SC-131 | Very long chat history (100+ messages) | Paginated or truncated display; "Load more" button. | 5 |
| SC-132 | Action log with 200 steps → export | Export trimmed to last 100 entries by default; full option. | 12 |
| SC-133 | Screenshot tab open while Agent tab active | Tabs isolated; no stale screenshot data shown. | 7 |
| SC-134 | Settings saved but panel doesn't reflect immediately | Settings force a re-render on save. | 1 |
| SC-135 | Error banner covers actionable content | Banner dismissible; pushes content down, doesn't overlap. | 8 |
| SC-136 | Confirm modal has no focus trap | Modal focus managed; Escape closes modal. | 15 |
| SC-137 | Keyboard-only user navigates panel | All buttons reachable via Tab; Enter to confirm. | 16 |
| SC-138 | Screen reader user navigates panel | ARIA labels on badges, buttons, banners. | 16 |

---

## 12. Build / Distribution Edge Cases (Low)

| # | Scenario | Expected Behavior | Phase |
|---|---|---|---|
| SC-139 | User installs ZIP missing `dist/` files | CI ensures ZIP is built fresh; README warns to use latest release. | 16 |
| SC-140 | User loads unpacked with an old manifest | Manifest version mismatch → Chrome shows "Update available." | 16 |
| SC-141 | Chrome version < 114 (minimum in manifest) | Load fails → README states min Chrome version. | 1 |
| SC-142 | Side Panel API not supported in browser | `chrome.sidePanel` undefined → error banner: "Side panel unsupported; update Chrome." | 1 |
| SC-143 | GitHub Pages landing page fails to deploy | CI fails the release; manual fallback in README. | 16 |
| SC-144 | Release ZIP contains `.env` accidentally | Pre-release script scans ZIP for API key patterns; build fails. | 16 |

---

## 13. Testing Strategy for Edge Cases

### 13.1 Manual Test Scenarios

Create a **test matrix spreadsheet** with columns:

| Scenario ID | Steps | Expected Result | Severity | Status | Notes |
|---|---|---|---|---|---|

Manual tests to prioritize (smoke):

1. **SC-01 / SC-02**: Open blocked banking URL → confirm agent disabled.
2. **SC-08**: Fill a password field via agent → confirm blocked.
3. **SC-28**: Put worker to sleep (dev tools → "Online/Offline" toggle) mid-loop → confirm restore.
4. **SC-52**: Force invalid JSON (mock server) → confirm retry + error.
5. **SC-59**: Mock 429 → confirm retry UI + fallback.
6. **SC-75**: Mock `targetNumber: 999` → confirm validation fail.
7. **SC-80**: Shadow DOM page → confirm warning.
8. **SC-98**: Right-click without selection → confirm disabled.
9. **SC-107**: Click disabled button via agent → confirm failure message.
10. **SC-118**: Corrupt session JSON → confirm fresh start.

### 13.2 Automated Checks (if feasible in 4 weeks)

```ts
// src/shared/__tests__/safety.test.ts
describe('isBlockedUrl', () => {
  test('blocks bank domains', () => expect(isBlockedUrl('https://bankofamerica.com/login')).toBe(true));
  test('blocks payment paths', () => expect(isBlockedUrl('https://shop.com/checkout')).toBe(true));
  test('allows normal pages', () => expect(isBlockedUrl('https://news.com/article')).toBe(false));
});

describe('isProtectedField', () => {
  test('blocks password fields', () => expect(isProtectedField({ type: 'password' })).toBe(true));
  test('blocks OTP', () => expect(isProtectedField({ attributes: { name: 'otp' } })).toBe(true));
});

describe('AgentActionSchema', () => {
  test('rejects out-of-range targetNumber', () =>
    expect(() => AgentActionSchema.parse({ type: 'click', targetNumber: 999, reason: 'x' })).toThrow());
});
```

Run via `npm test` in CI.

### 13.3 Pre-Release Checklist

- [ ] No `apiKey` / `token` / `secret` in repo (search code + ZIP).
- [ ] All 24 edge-case categories pass smoke tests.
- [ ] Service-worker sleep test verified.
- [ ] JSON validation verified with malicious payloads.
- [ ] Blocked pages never send data externally (network tab inspection).

---

## 14. Escalation / Incident Handling

If an edge case is **not** handled gracefully:

1. **Do not ship** until the crash is reproduced and fixed.
2. Log the incident in `docs/edge-case-handling.md` with:
   - Scenario ID (new or existing)
   - Reproduction steps
   - Impact (data loss / privacy leak / crash)
   - Fix + verification
3. Add to `edge-case.md` for future regression testing.

---

## 15. Open Questions

| # | Question | Decision Owner |
|---|---|---|
| EQ-01 | What exact practice sites will be used for Week 3 errands? (Need allowlist to test SC-05 bypasses) | PM |
| EQ-02 | Should Hinglish default to Roman script or Devanagari? (Affects SC-93) | PM |
| EQ-03 | Do we support shadow DOM scanning in a future release? (SC-83 currently blocked) | Architecture |
| EQ-04 | What is the max file size for screenshot crop? (SC-103 compression threshold) | Implementation |

---

*This document is living. Add new scenarios as they are discovered during testing. Tag each with `SC-NNN` for traceability to the test matrix.*