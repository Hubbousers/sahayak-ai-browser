# Sahayak AI Browser Extension — UI Verification & Test Guide

This document outlines step-by-step UI test scenarios to manually test and verify every phase (especially **Phases 12, 13, 14, 15, and 16**).

---

## 🛠️ Step 0: Setup & Loading the Extension

1. **Build the extension**:
   ```bash
   npm run build
   ```
2. **Load into Google Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (top-right toggle).
   - Click **Load unpacked** (top-left button).
   - Select the `dist/` directory inside this repository.
   - If previously loaded, click the **Reload** 🔄 icon on the Sahayak card.
3. **Open the Side Panel**:
   - Click the Chrome **Extensions puzzle icon** and pin **Sahayak**.
   - Click the **Sahayak** icon in your toolbar to open the native Side Panel.
4. **Enter API Key**:
   - Switch to the **Settings** (gear icon) tab in the Side Panel.
   - Paste your free Gemini API key (from [Google AI Studio](https://aistudio.google.com/)).
   - Click **Save Settings**. (A green "Settings saved" message should appear).

---

## 🧪 UI Test Cases

### Test Suite 1: Phase 14 — Profile Memory & Skills

#### Test Case 1.1: Local Profile CRUD & Persistence
- **Action**:
  1. Open the **Profile** tab (user icon).
  2. Enter **Full Name**: e.g., `Tarun Sharma`.
  3. Enter **College**: e.g., `Masai School`.
  4. Select **Preferred Tone**: `Friendly & Warm`.
  5. Add skills: type `React` -> Click **Add**; type `TypeScript` -> Click **Add**.
  6. Add a profile link: type `https://github.com/myname` -> Click **Add**.
  7. Click **Save Profile**.
  8. Close the Side Panel and reopen it (or reload the extension).
- **Expected Result**: All profile data is preserved and reloaded.

#### Test Case 1.2: Context Menu / Reply Draft Profile Injection
- **Action**:
  1. Highlight any paragraph of text on a webpage.
  2. Right-click and choose **Sahayak — Draft a reply**.
- **Expected Result**: Side panel switches to Chat; the drafted reply greets or references the user's name/tone from the saved profile.

#### Test Case 1.3: Skills CRUD & Backup Export / Import
- **Action**:
  1. Open the **Skills** tab (lightning icon).
  2. Click **Add Skill**.
  3. Name: `Bullet Key Points`, Category: `summarize`, Template: `Give 3 concise bullets: {{selectedText}}`.
  4. Click **Save Skill**. Verify it appears in the list.
  5. Click the **Export** button in the Skills header.
  6. Verify `sahayak_backup_<date>.json` is downloaded.
  7. Delete the skill or edit it.
  8. Click the **Import** button and select the exported JSON file.
- **Expected Result**: Export downloads a valid JSON bundle; import restores the skills and profile seamlessly.

---

### Test Suite 2: Phase 15 — Safety Rails & Protected Fields

#### Test Case 2.1: URL Blocklist (Sensitive Domains & Paths)
- **Action**:
  1. Navigate to a banking or payment URL (e.g. `https://www.bankofamerica.com` or any URL containing `/checkout` or `/login`).
  2. Open the **Agent** tab in Sahayak.
  3. Try starting an agent with goal: `Explore page`.
- **Expected Result**: Agent refuses to execute on the page. Terminal step indicates: *"This page type is restricted for safety reasons (banking/payment/login). Agent mode disabled."*

#### Test Case 2.2: Screenshot Blocked on Sensitive Pages
- **Action**:
  1. On any blocked/sensitive page (or login page), navigate to the **Visual** tab.
  2. Click **Capture View**.
- **Expected Result**: Error banner displayed: *"Screenshots are disabled on sensitive pages (banking, login, payment) for privacy and security."* No image captured.

#### Test Case 2.3: Protected Field Shielding (Passwords, OTPs, Cards)
- **Action**:
  1. Open the local `test_bench.html` file in Chrome (`file:///.../test_bench.html`).
  2. In the **Agent** tab, start a goal: `Fill the password and OTP fields with 123456`.
- **Expected Result**: Agent safety guard triggers: *"Safety guard: Element #X is a protected field. Agent typing is blocked."* Neither password nor OTP are written to.

#### Test Case 2.4: Consequential Action Double-Confirmation
- **Action**:
  1. On `test_bench.html`, run an agent goal: `Click the Submit Application button`.
  2. Wait for the step proposal.
- **Expected Result**:
  - The Action card appears with a red consequential alert border and label: *"Consequential action: This step will submit or confirm. Please verify before approving."*
  - The green "Approve Step" button is disabled until the user clicks the red **"Confirm & Proceed"** button first.

#### Test Case 2.5: Emergency Kill Switch
- **Action**:
  1. Start an agent run.
  2. While an action is pending or in progress, click the red **Stop** button.
- **Expected Result**: The session stops immediately, changes to non-running state, and preserves all previously logged steps.

---

### Test Suite 3: Phase 12 & 13 — Agent Controls, Logs & Practice Tasks

#### Test Case 3.1: Dry-Run Mode
- **Action**:
  1. On `test_bench.html`, check the **Dry-run (Highlight only)** checkbox in the Agent tab.
  2. Start goal: `Click the Safe Button`.
  3. Click **Approve Step**.
- **Expected Result**: The target element on the page pulses / highlights, but the browser does NOT trigger the button click (alert does not pop up).

#### Test Case 3.2: Step Limit Enforcement
- **Action**:
  1. In **Settings**, set `Agent Step Limit` to `2`. Click **Save Settings**.
  2. In **Agent**, run any task with 3+ potential steps.
  3. Approve Step 1 and Step 2.
- **Expected Result**: At Step 2, the agent stops proposing interactive actions and proposes `done` with reason: *"Reached maximum exploration step limit (2 steps). Stopping for manual review."*

#### Test Case 3.3: Session Log Export
- **Action**:
  1. After running any agent steps, look at the top-right header of the Agent panel.
  2. Click **JSON** and **MD**.
- **Expected Result**:
  - `sahayak_agent_log_<sessionId>.json` downloads with full step array and timestamps.
  - `sahayak_agent_log_<sessionId>.md` downloads formatted in GitHub Markdown.

#### Test Case 3.4: Worker Sleep & Reopening Restoration
- **Action**:
  1. Start an agent goal so an action is awaiting approval.
  2. Close the Chrome Side Panel.
  3. Reopen the Side Panel on the same tab.
- **Expected Result**: The active goal, progress bar, action card, and step history automatically rehydrate from `chrome.storage.local`.

---

### Test Suite 4: Phase 16 — Installation & Deliverables Verification

1. **Standalone Package Verification**:
   - Locate `sahayak-extension.zip` in the root folder.
   - Extract it to a temporary folder and load into Chrome via **Load unpacked**.
   - Verify that all tabs (Summary, Chat, Visual, Agent, Skills, Profile, Settings) open cleanly with zero console errors.
2. **GitHub Pages Landing Page**:
   - Open `docs/index.html` in any browser.
   - Verify layout, cards, typography, and installation steps render cleanly.
3. **API Key Security Check**:
   - Check `.gitignore` to ensure `.env` and sensitive files are excluded.

