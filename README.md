# Sahayak (सहायक) — AI Browser Assistant

[![Build and Package Sahayak Extension](https://github.com/tarun-sharma/sahayak-ai-browser/actions/workflows/build.yml/badge.svg)](https://github.com/tarun-sharma/sahayak-ai-browser/actions/workflows/build.yml)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Gemini 2.5](https://img.shields.io/badge/AI-Google%20Gemini%20API-orange)](https://ai.google.dev/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20Storage-green)]()

Sahayak is a privacy-first, human-in-the-loop AI browser assistant built as a Chrome Extension (Manifest V3) running inside the native **Chrome Side Panel**. It combines grounded page chat, instant article & YouTube summarization, visual comprehension, and a controlled browser automation agent requiring human approval before executing web actions.

---

## Key Features

- **⚡ Structured Summarization**: Clean, readable summaries of any news article or long-form blog post (TL;DR, key takeaways, next actions) in English or conversational Hinglish.
- **🎬 YouTube Video Summarizer**: Automatically extracts transcripts, identifies video chapters, and generates timestamped chapter takeaways.
- **💬 Grounded Page Chat**: Conversational AI directly grounded on the text of the active browser tab without hallucinations.
- **👁️ Visual Understanding**: Instant tab screenshot capture and visual question-answering with on-device memory purging.
- **🤖 Numbered DOM Scanner & Agent**: Scans interactive elements, overlays numbered badge highlights, and proposes single-step browser interactions (click, type, scroll, done).
- **🛡️ Human-in-the-Loop & Dry-Run Mode**: Every action requires explicit user approval (`Approve`, `Skip`, `Stop`). Includes a safe dry-run mode (highlight without executing mutations).
- **🔒 Code-Level Safety Guardrails**: Hard-coded safety blocks on banking, digital wallets, payment gateways, and login pages. Automated protection against writing into passwords, OTPs, or credit card inputs.
- **🧠 Local Memory & Skills**: Stored personal profile and customizable prompt templates (`{{selectedText}}`, `{{profile}}`) with full JSON backup export and import.

---

## Architecture & Technology Stack

- **Extension Framework**: Chrome Extension Manifest V3, Side Panel API, Service Worker background architecture.
- **Frontend**: React 18, TypeScript, Vite, Tailwind-styled components, Lucide icons.
- **AI Models**: Google Gemini 2.5 Flash / Flash-Lite with Groq fallback orchestration and exponential backoff retry handling.
- **DOM Parsing**: Mozilla Readability engine, custom stable CSS selector generator, and DOM mutation observers.
- **Privacy**: Local-only persistence using `chrome.storage.local`. No analytics, telemetry, or remote servers.

---

## Quick Start & Installation

### Option 1: Load Pre-Built Release (Easiest)

1. Download [`sahayak-extension.zip`](https://github.com/tarun-sharma/sahayak-ai-browser/releases) or build locally via `npm run build`.
2. Extract the ZIP archive onto your computer.
3. Open Google Chrome and navigate to `chrome://extensions`.
4. Turn on **Developer mode** using the toggle switch in the top-right corner.
5. Click **Load unpacked** in the top-left corner and select the extracted `dist` folder.
6. Click the extension puzzle piece icon, pin **Sahayak**, and click its icon to open the Side Panel.

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/tarun-sharma/sahayak-ai-browser.git
cd sahayak-ai-browser

# Install dependencies
npm install

# Build production bundle
npm run build
```

Then load the resulting `dist/` directory in `chrome://extensions` via **Load unpacked**.

---

## Configuration & API Key Setup

1. Obtain a free API key from [Google AI Studio](https://aistudio.google.com/).
2. Open the Sahayak Side Panel and navigate to the **Settings** tab (gear icon).
3. Paste your Gemini API key in the API Key input field.
4. (Optional) Provide a Groq API key for high-speed fallback text processing.
5. Click **Save Settings**. Your API key is stored strictly inside your browser's private local storage (`chrome.storage.local`) and is never logged or transmitted elsewhere.

---

## Safety Rails & Privacy Guarantees

Sahayak enforces strict safety rules directly in code:

| Safety Guard | Enforcement Mechanism |
|---|---|
| **Restricted URLs** | Agent and screenshot features are completely disabled on banking domains (`*.bankofamerica.com`, `hdfcbank.com`, etc.), UPI/wallets (`paytm`, `phonepe`, `stripe`), and authentication pages (`/login`, `/signin`). |
| **Protected Fields** | Password inputs, PINs, OTP codes, and credit/debit card numbers are strictly blocked from automated input. |
| **Consequential Actions** | Critical buttons (Submit, Pay, Checkout, Transfer, Confirm, Delete) trigger a prominent red secondary confirmation prompt. |
| **Kill Switch** | Immediate `Stop` button in the Agent control header terminates loops instantly and preserves the action log. |
| **Local-Only Data** | All profiles, skills, and chat sessions reside solely in `chrome.storage.local`. |

---

## Practice Errand Library (Phase 13)

Sahayak comes with pre-configured practice errand templates:
- **Internship & Job Applications**: Multi-step form filling using your local profile memory while skipping submission and sensitive fields.
- **E-Commerce Search & Filtering**: Searching products and applying sorting/filters without adding items to carts or checking out.
- **Paginated Data Extraction**: Collecting table rows and item listings across pagination into downloadable CSV spreadsheets.

---

## Project Structure

```
├── .github/workflows/build.yml     # Automated CI build and release packaging
├── docs/index.html                 # GitHub Pages project showcase
├── public/                         # Extension icons and manifest.json
├── src/
│   ├── background/                 # Service Worker, API orchestration, lifecycle
│   ├── content/                    # Page scanner, Readability extraction, action execution
│   ├── panel/                      # React Side Panel UI components & tab views
│   ├── shared/                     # Storage stores, Zod schemas, types, and safety rules
│   └── tools/                      # Practice errands and prompt template libraries
├── Docs/                           # Architectural, implementation, and edge-case specs
├── vite.config.ts                  # Vite multi-bundle build configuration
└── tsconfig.json                   # TypeScript configuration
```

---

## License

MIT License. Designed and engineered for safe, human-centric web exploration.
