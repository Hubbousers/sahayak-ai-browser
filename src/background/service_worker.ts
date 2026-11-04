// Sahayak Background Service Worker (Manifest V3)
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@shared/constants';
import { PanelToBg, BgToPanel, ExtensionSettings, AgentSession, AgentStep, UserProfile } from '@shared/types';
import { isBlockedUrl, isConsequential, isProtectedField } from '@shared/safety';
import { generateText, ModelIntent } from '@shared/model/orchestrate';
import {
  buildArticleSummaryPrompt,
  SummarySchema,
  buildYouTubeSummaryPrompt,
  YouTubeSummarySchema,
  buildPageChatPrompt,
  buildFindItPrompt,
  FindItSchema,
  buildAgentNextStepPrompt,
  AgentActionSchema
} from '@tools/prompt-templates';
import { extractJson, validateWithSchema } from '@shared/json';
import { extractYouTube } from '@shared/youtube';

console.log('Sahayak loaded');

// Helper to safely send message to runtime/panel
export function sendToPanel(message: BgToPanel): void {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel may be closed, ignore
    });
  }
}

// Helper to fetch current settings from chrome.storage.local
async function getStoredSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve(DEFAULT_SETTINGS);
      return;
    }
    chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (items) => {
      const stored = items[STORAGE_KEYS.SETTINGS];
      if (!stored) {
        resolve(DEFAULT_SETTINGS);
        return;
      }
      resolve({
        ...DEFAULT_SETTINGS,
        ...stored,
        apiKey: stored.apiKey && stored.apiKey.trim() !== '' ? stored.apiKey : DEFAULT_SETTINGS.apiKey
      });
    });
  });
}

/**
 * Ensures the content script is active in the given tab.
 * Injects it programmatically if the tab hasn't loaded it yet (e.g. tabs opened before extension reload).
 */
async function ensureContentScript(tabId: number): Promise<boolean> {
  // Test if alive
  try {
    const pingRes = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    if (pingRes?.status === 'alive') return true;
  } catch {
    // Content script not listening yet, inject it
  }

  if (chrome.scripting && chrome.scripting.executeScript) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content_script.js']
      });
      // Pause to allow the script to evaluate and register its runtime listener
      await new Promise((r) => setTimeout(r, 250));
      return true;
    } catch (injectErr: any) {
      console.warn('Programmatic script injection failed on tab:', tabId, injectErr?.message || injectErr);
      return false;
    }
  }
  return false;
}

// --- Agent Orchestration & Session Persistence ---

async function getStoredProfile(): Promise<UserProfile | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.PROFILE], (res) => {
      resolve(res[STORAGE_KEYS.PROFILE] || null);
    });
  });
}

async function getActiveSession(): Promise<AgentSession | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.ACTIVE_SESSION_ID, STORAGE_KEYS.SESSIONS], (res) => {
      const activeId = res[STORAGE_KEYS.ACTIVE_SESSION_ID];
      const sessions = res[STORAGE_KEYS.SESSIONS] || {};
      resolve(activeId && sessions[activeId] ? sessions[activeId] : null);
    });
  });
}

async function saveSession(session: AgentSession): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.SESSIONS], (res) => {
      const sessions = res[STORAGE_KEYS.SESSIONS] || {};
      sessions[session.id] = session;
      // Clear active session ID when session is no longer running or is completed
      const isActive = session.running && !session.completed;
      chrome.storage.local.set(
        {
          [STORAGE_KEYS.SESSIONS]: sessions,
          [STORAGE_KEYS.ACTIVE_SESSION_ID]: isActive ? session.id : null
        },
        () => resolve()
      );
    });
  });
}

/**
 * Executes a single AI proposal step for the active AgentSession.
 * Reads the latest DOM interactive elements map, formats the step context,
 * invokes the model, validates strictly via AgentActionSchema, and presents the proposal
 * for human approval.
 */
async function proposeNextStep(session: AgentSession): Promise<{ ok: boolean; step?: AgentStep; error?: string }> {
  const settings = await getStoredSettings();
  if (!settings.apiKey) {
    return { ok: false, error: 'No Gemini API key found. Please open Settings and enter your key.' };
  }

  // Check step limit (Phase 12)
  if (session.steps.length >= session.stepLimit) {
    const doneStep: AgentStep = {
      id: `step_${Date.now()}`,
      phase: 'propose',
      action: {
        type: 'done',
        reason: `Reached maximum exploration step limit (${session.stepLimit} steps). Stopping for manual review.`
      },
      reason: `Reached maximum exploration step limit (${session.stepLimit} steps).`,
      timestamp: Date.now()
    };
    session.steps.push(doneStep);
    session.running = false;
    session.completed = true;
    session.updatedAt = Date.now();
    await saveSession(session);
    sendToPanel({ type: 'agentNewProposal', step: doneStep });
    return { ok: true, step: doneStep };
  }

  // Safety blocklist check
  if (isBlockedUrl(session.url)) {
    const doneStep: AgentStep = {
      id: `step_${Date.now()}`,
      phase: 'propose',
      action: {
        type: 'done',
        reason: 'This page type is restricted for safety reasons (banking/payment/login). Agent mode disabled.'
      },
      reason: 'Safety restriction triggered.',
      timestamp: Date.now()
    };
    session.steps.push(doneStep);
    session.running = false;
    session.completed = true;
    session.updatedAt = Date.now();
    await saveSession(session);
    sendToPanel({ type: 'agentNewProposal', step: doneStep });
    return { ok: true, step: doneStep };
  }

  // Verify tab exists and inspect URL
  let targetTab: chrome.tabs.Tab | undefined;
  try {
    targetTab = await chrome.tabs.get(session.tabId);
  } catch {
    // If original tab closed or unavailable, query active tab
    const [act] = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTab = act;
    if (act?.id) session.tabId = act.id;
  }

  const curUrl = targetTab?.url || session.url || '';
  if (curUrl.startsWith('chrome://') || curUrl.startsWith('edge://') || curUrl.startsWith('about:') || curUrl.startsWith('chrome-extension://')) {
    return {
      ok: false,
      error: 'Cannot run agent on browser internal pages (chrome://, edge://, etc.). Please switch to a regular web page.'
    };
  }

  // 1. Ensure content script and scan elements
  const injected = await ensureContentScript(session.tabId);
  let scanRes: any;
  try {
    scanRes = await chrome.tabs.sendMessage(session.tabId, {
      type: 'scanElements',
      showBadges: true
    });
  } catch (err: any) {
    // Retry once with fresh injection
    if (!injected && chrome.scripting?.executeScript) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: session.tabId },
          files: ['src/content/content_script.js']
        });
        await new Promise((r) => setTimeout(r, 300));
        scanRes = await chrome.tabs.sendMessage(session.tabId, {
          type: 'scanElements',
          showBadges: true
        });
      } catch (retryErr: any) {
        return {
          ok: false,
          error: `Could not access page DOM: ${retryErr?.message || err?.message || 'Please refresh the webpage and try again.'}`
        };
      }
    } else {
      return {
        ok: false,
        error: `Could not connect to page: ${err?.message || 'Please reload the webpage tab and try again.'}`
      };
    }
  }

  if (scanRes && !scanRes.ok) {
    return { ok: false, error: scanRes.error || 'Failed to scan DOM elements on target tab.' };
  }

  const elements = scanRes?.elements || [];
  const profile = await getStoredProfile();

  // Executed history
  const executedSteps = session.steps
    .filter((s) => s.phase === 'approved' && s.executed)
    .map((s) => ({ action: s.action, reason: s.reason }));

  const prompt = buildAgentNextStepPrompt({
    goal: session.goal,
    elements,
    executedSteps,
    profile: profile || undefined,
    language: settings.preferredLanguage
  });

  const intent: ModelIntent = { kind: 'agent_next_action', difficulty: 'medium' };

  let proposedAction: any = null;
  let lastGenErr: any = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const genResult = await generateText({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      intent,
      apiKey: settings.apiKey,
      groqApiKey: settings.groqApiKey,
      preferredTier: settings.modelTier,
      onRetry: (att, delaySec) => {
        sendToPanel({ type: 'apiRetry', attempt: att, retryAfterSecs: delaySec });
      }
    });

    if (!genResult.success) {
      lastGenErr = genResult.error;
      break;
    }

    const extracted = extractJson(genResult.text);
    if (extracted.success) {
      const validated = validateWithSchema(AgentActionSchema, extracted.data);
      if (validated.success) {
        proposedAction = validated.data;
        break;
      }
    }
  }

  if (!proposedAction) {
    return {
      ok: false,
      error: lastGenErr?.message || "I couldn't understand my instructions. Please rephrase your task."
    };
  }

  // Safety: Consequential action detection check
  if (proposedAction.targetNumber) {
    const targetEl = elements.find((el: any) => el.number === proposedAction.targetNumber);
    if (targetEl) {
      // Re-verify protected field (e.g. model tried to type into password)
      if (proposedAction.type === 'type' && isProtectedField(targetEl)) {
        return {
          ok: false,
          error: `Safety guard: Element #${proposedAction.targetNumber} (${targetEl.label}) is a protected field. Agent typing is blocked.`
        };
      }

      if (isConsequential(targetEl)) {
        proposedAction.requiresExtraConfirm = true;
      }
    }
  }

  const newStep: AgentStep = {
    id: `step_${Date.now()}`,
    phase: 'propose',
    action: proposedAction,
    reason: proposedAction.reason,
    timestamp: Date.now()
  };

  session.steps.push(newStep);
  session.currentStepIndex = session.steps.length - 1;
  session.updatedAt = Date.now();
  await saveSession(session);

  sendToPanel({ type: 'agentNewProposal', step: newStep });
  return { ok: true, step: newStep };
}

// 1. Configure Side Panel Behavior
if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  if (chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Error setting panel behavior:', error));
  }
}

// 2. Action click handler
if (typeof chrome !== 'undefined' && chrome.action) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id && chrome.sidePanel && chrome.sidePanel.open) {
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
      } catch (err) {
        console.warn('Could not open side panel for tab:', tab.id, err);
      }
    }
  });
}

// 3. Keyboard command handler (Ctrl+Shift+Y)
if (typeof chrome !== 'undefined' && chrome.commands) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'open-side-panel') {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id && chrome.sidePanel && chrome.sidePanel.open) {
        try {
          await chrome.sidePanel.open({ tabId: activeTab.id });
        } catch (err) {
          console.warn('Could not open side panel via command:', err);
        }
      }
    }
  });
}

// 4. Register Context Menu Items on installation
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled.addListener(() => {
    console.log('Sahayak extension installed/updated');

    chrome.storage.local.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.LANGUAGE], (items) => {
      if (!items[STORAGE_KEYS.SETTINGS]) {
        chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
      }
      if (!items[STORAGE_KEYS.LANGUAGE]) {
        chrome.storage.local.set({ [STORAGE_KEYS.LANGUAGE]: DEFAULT_SETTINGS.preferredLanguage });
      }
    });

    if (chrome.contextMenus) {
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: 'explain',
          title: 'Sahayak — Explain this',
          contexts: ['selection']
        });

        chrome.contextMenus.create({
          id: 'translate',
          title: 'Sahayak — Translate to Hindi',
          contexts: ['selection']
        });

        chrome.contextMenus.create({
          id: 'draft_reply',
          title: 'Sahayak — Draft a reply',
          contexts: ['selection']
        });
      });
    }
  });
}

// 5. Context Menu Handler with real Gemini API call
if (typeof chrome !== 'undefined' && chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    // Open side panel
    if (chrome.sidePanel && chrome.sidePanel.open) {
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
      } catch {
        // Continue
      }
    }

    const action = info.menuItemId as 'explain' | 'translate' | 'draftReply' | 'draft_reply';
    const normalizedAction = action === 'draft_reply' ? 'draftReply' : action;
    const selectedText = info.selectionText || '';

    if (!selectedText.trim()) return;

    const settings = await getStoredSettings();
    if (!settings.apiKey) {
      sendToPanel({
        type: 'error',
        code: 'ERR_NO_API_KEY',
        message: 'No Gemini API key found. Please open Settings and enter your key.'
      });
      return;
    }

    const languageInstruction =
      settings.preferredLanguage === 'hi'
        ? 'Respond in Hinglish (Hindi written in Roman script, natural mix with English terms).'
        : 'Respond in clear, natural English.';

    const profile = await getStoredProfile();

    let prompt = '';
    if (normalizedAction === 'explain') {
      prompt = `Explain the following text in plain language. Keep it concise, accessible, and structured with bullet points if helpful.\n\nText:\n"${selectedText}"\n\n${languageInstruction}`;
    } else if (normalizedAction === 'translate') {
      prompt = `Translate and explain the following text into conversational Hindi written in Roman script (Hinglish).\n\nText:\n"${selectedText}"`;
    } else {
      const profileContext = profile && profile.name
        ? `\nUser Profile Context:\n- Name: ${profile.name}\n- Preferred Tone: ${profile.preferredTone || 'friendly'}${profile.college ? `\n- College: ${profile.college}` : ''}${profile.skills?.length ? `\n- Skills: ${profile.skills.join(', ')}` : ''}\nUse the user's name or preferred tone when drafting the reply if natural.`
        : '';
      prompt = `Draft a polite, thoughtful, and context-appropriate reply to the following text.${profileContext}\n\nText:\n"${selectedText}"\n\n${languageInstruction}`;
    }

    const intent: ModelIntent = { kind: normalizedAction as any, difficulty: 'easy' };

    const result = await generateText({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      intent,
      apiKey: settings.apiKey,
      groqApiKey: settings.groqApiKey,
      preferredTier: settings.modelTier,
      onRetry: (attempt, delaySec) => {
        sendToPanel({ type: 'apiRetry', attempt, retryAfterSecs: delaySec });
      }
    });

    if (result.success) {
      sendToPanel({
        type: 'contextActionResult',
        action: normalizedAction as 'explain' | 'translate' | 'draftReply',
        output: result.text
      });
    } else if (result.error) {
      sendToPanel({
        type: 'error',
        code: result.error.code,
        message: result.error.message
      });
    }
  });
}

// 6. Central Message Router
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: PanelToBg, sender, sendResponse) => {
    console.log('Background received message:', message.type);

    (async () => {
      switch (message.type) {
        case 'init': {
          const tabId = message.tabId || sender.tab?.id || 0;
          const activeSession = await getActiveSession();
          if (activeSession) {
            sendToPanel({ type: 'agentSessionLoaded', session: activeSession });
          }
          sendResponse({ ok: true, status: 'ready', tabId, activeSession });
          break;
        }

        case 'chatSend': {
          const settings = await getStoredSettings();
          if (!settings.apiKey) {
            sendResponse({
              ok: false,
              error: {
                code: 'ERR_NO_API_KEY',
                message: 'No Gemini API key found. Please open Settings and enter your key.'
              }
            });
            return;
          }

          // 1. Determine page context for grounding
          let pageTitle = message.pageContext?.title || '';
          let pageTextContent = message.pageContext?.textContent || '';

          if (!pageTextContent && message.mode === 'page') {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id) {
              pageTitle = activeTab.title || 'Current Web Page';
              try {
                const articleResponse = await chrome.tabs.sendMessage(activeTab.id, {
                  type: 'getArticleContent'
                });
                if (articleResponse?.article?.textContent) {
                  pageTextContent = articleResponse.article.textContent;
                  pageTitle = articleResponse.article.title || pageTitle;
                }
              } catch {
                // Programmatic injection fallback
                try {
                  if (chrome.scripting && chrome.scripting.executeScript) {
                    await chrome.scripting.executeScript({
                      target: { tabId: activeTab.id },
                      files: ['src/content/content_script.js']
                    });
                    await new Promise((r) => setTimeout(r, 150));
                    const retryRes = await chrome.tabs.sendMessage(activeTab.id, {
                      type: 'getArticleContent'
                    });
                    if (retryRes?.article?.textContent) {
                      pageTextContent = retryRes.article.textContent;
                      pageTitle = retryRes.article.title || pageTitle;
                    }
                  }
                } catch {
                  // Fallback to plain prompt if page is restricted
                }
              }
            }
          }

          // 2. Build prompt: grounded prompt if page content exists, otherwise standard assistant prompt
          let prompt = '';
          const hasPageContext = pageTextContent.trim().length > 50;

          if (hasPageContext) {
            prompt = buildPageChatPrompt({
              pageTitle,
              pageContent: pageTextContent,
              question: message.message,
              conversationHistory: message.history,
              language: settings.preferredLanguage
            });
          } else {
            const languageInstruction =
              settings.preferredLanguage === 'hi'
                ? 'Respond in Hinglish (Hindi written in Roman script, natural mix with English terms).'
                : 'Respond in clear, natural English.';
            prompt = `You are Sahayak, an AI browser assistant. Assist the user concisely and helpfully.\n\nUser Question:\n${message.message}\n\n${languageInstruction}`;
          }

          const intent: ModelIntent = { kind: 'chat', difficulty: 'easy' };

          const result = await generateText({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            intent,
            apiKey: settings.apiKey,
            groqApiKey: settings.groqApiKey,
            preferredTier: settings.modelTier,
            onRetry: (attempt, delaySec) => {
              sendToPanel({ type: 'apiRetry', attempt, retryAfterSecs: delaySec });
            }
          });

          if (result.success) {
            // Append assistant response to chat history and persist
            const chatHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];
            if (Array.isArray(message.history)) {
              for (const h of message.history) {
                chatHistory.push({ role: h.sender === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] });
              }
            }
            chatHistory.push({ role: 'model', parts: [{ text: result.text }] });
            chrome.storage.local.set({ [STORAGE_KEYS.MESSAGES]: chatHistory });

            const isGrounded =
              hasPageContext &&
              !result.text.includes("I couldn't find this in the current page") &&
              !result.text.includes("I couldn't find this on the current page");

            sendResponse({
              ok: true,
              text: result.text,
              model: result.model,
              grounded: isGrounded,
              pageTitle: hasPageContext ? pageTitle : undefined,
              // Echo back updated history for potential UI use
              history: chatHistory
            });
          } else {
            sendResponse({
              ok: false,
              error: result.error
            });
          }
          break;
        }

        case 'requestSummary': {
          const settings = await getStoredSettings();
          if (!settings.apiKey) {
            sendResponse({
              ok: false,
              error: {
                code: 'ERR_NO_API_KEY',
                message: 'No Gemini API key found. Please open Settings and enter your key.'
              }
            });
            return;
          }

          // 1. Get active tab
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab?.id) {
            sendResponse({
              ok: false,
              error: {
                code: 'ERR_TAB_NOT_FOUND',
                message: 'Could not access the active browser tab.'
              }
            });
            return;
          }

          // 2. Request readable extraction from content script
          let articleResponse: any = null;
          try {
            articleResponse = await chrome.tabs.sendMessage(activeTab.id, {
              type: 'getArticleContent'
            });
          } catch (tabErr) {
            console.warn('Content script not reachable, injecting programmatically:', tabErr);
            try {
              if (chrome.scripting && chrome.scripting.executeScript) {
                await chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  files: ['src/content/content_script.js']
                });
                // Small pause to allow content script initialization
                await new Promise((r) => setTimeout(r, 200));
                articleResponse = await chrome.tabs.sendMessage(activeTab.id, {
                  type: 'getArticleContent'
                });
              }
            } catch (injectErr) {
              console.error('Programmatic injection failed:', injectErr);
            }
          }

          const article = articleResponse?.article;
          if (!article || !article.textContent || article.textContent.trim().length < 50) {
            sendResponse({
              ok: false,
              error: {
                code: 'ERR_READABILITY_EMPTY',
                message: "I couldn't extract readable article text from this page. It may be empty or rely on dynamic canvas/iframes."
              }
            });
            return;
          }

          // 3. Build summary prompt
          const prompt = buildArticleSummaryPrompt({
            title: article.title || activeTab.title || 'Web Page',
            articleText: article.textContent,
            language: settings.preferredLanguage
          });

          // 4. Generate summary with Gemini
          const intent: ModelIntent = { kind: 'summarize', difficulty: 'easy' };

          let summaryOutput: any = null;
          let lastGenResult: any = null;

          // Attempt generation (with retry if JSON extraction fails)
          for (let attempt = 0; attempt < 2; attempt++) {
            const genResult = await generateText({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              intent,
              apiKey: settings.apiKey,
              groqApiKey: settings.groqApiKey,
              preferredTier: settings.modelTier,
              onRetry: (att, delaySec) => {
                sendToPanel({ type: 'apiRetry', attempt: att, retryAfterSecs: delaySec });
              }
            });
            lastGenResult = genResult;

            if (!genResult.success) {
              break;
            }

            const extracted = extractJson(genResult.text);
            if (extracted.success) {
              const validated = validateWithSchema(SummarySchema, extracted.data);
              if (validated.success) {
                summaryOutput = validated.data;
                break;
              }
            }
          }

          if (summaryOutput) {
            const structuredSummary = {
              tldr: summaryOutput.tldr,
              keyPoints: summaryOutput.keyPoints,
              nextSteps: summaryOutput.actions,
              actions: summaryOutput.actions
            };

            sendToPanel({
              type: 'articleSummary',
              summary: structuredSummary,
              language: settings.preferredLanguage
            });

            sendResponse({
              ok: true,
              summary: structuredSummary,
              articleTitle: article.title,
              siteName: article.siteName
            });
          } else {
            sendResponse({
              ok: false,
              error: lastGenResult?.error || {
                code: 'ERR_INVALID_JSON',
                message: "The AI model couldn't format the summary as structured JSON. Please try again."
              }
            });
          }
          break;
        }

        case 'requestYouTubeSummary': {
          const settings = await getStoredSettings();
          if (!settings.apiKey) {
            sendResponse({
              ok: false,
              error: {
                code: 'ERR_NO_API_KEY',
                message: 'No Gemini API key found. Please open Settings and enter your key.'
              }
            });
            return;
          }

          let ytContent;
          try {
            ytContent = await extractYouTube(message.url);
          } catch (ytErr: any) {
            sendResponse({
              ok: false,
              error: {
                code: 'ERR_YOUTUBE_EXTRACTION',
                message: ytErr?.message || 'Unsupported or private YouTube link.'
              }
            });
            return;
          }

          const prompt = buildYouTubeSummaryPrompt({
            title: ytContent.title,
            transcript: ytContent.transcript,
            hasTranscript: ytContent.hasTranscript,
            language: settings.preferredLanguage
          });

          const intent: ModelIntent = { kind: 'summarize', difficulty: 'easy' };

          let ytSummaryOutput: any = null;
          let lastYtGenResult: any = null;

          for (let attempt = 0; attempt < 2; attempt++) {
            const genResult = await generateText({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              intent,
              apiKey: settings.apiKey,
              groqApiKey: settings.groqApiKey,
              preferredTier: settings.modelTier,
              onRetry: (att, delaySec) => {
                sendToPanel({ type: 'apiRetry', attempt: att, retryAfterSecs: delaySec });
              }
            });
            lastYtGenResult = genResult;

            if (!genResult.success) {
              break;
            }

            const extracted = extractJson(genResult.text);
            if (extracted.success) {
              const validated = validateWithSchema(YouTubeSummarySchema, extracted.data);
              if (validated.success) {
                ytSummaryOutput = validated.data;
                break;
              }
            }
          }

          if (ytSummaryOutput) {
            const finalYtSummary = {
              videoId: ytContent.videoId,
              title: ytContent.title,
              tldr: ytSummaryOutput.tldr,
              keyPoints: ytSummaryOutput.keyPoints,
              chapters: ytSummaryOutput.chapters || [],
              actions: ytSummaryOutput.actions || []
            };

            sendToPanel({
              type: 'youtubeSummary',
              summary: finalYtSummary,
              language: settings.preferredLanguage
            });

            sendResponse({
              ok: true,
              summary: finalYtSummary,
              hasTranscript: ytContent.hasTranscript,
              author: ytContent.author
            });
          } else {
            sendResponse({
              ok: false,
              error: lastYtGenResult?.error || {
                code: 'ERR_INVALID_JSON',
                message: "The AI model couldn't format the YouTube summary as structured JSON."
              }
            });
          }
          break;
        }

        case 'setSettings': {
          chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: message.settings }, () => {
            chrome.storage.local.set({ [STORAGE_KEYS.LANGUAGE]: message.settings.preferredLanguage });
            sendToPanel({ type: 'settingsSaved' });
            sendResponse({ ok: true });
          });
          break;
        }

        case 'getProfile': {
          const profile = await getStoredProfile();
          sendResponse({ ok: true, profile });
          break;
        }

        case 'setProfile': {
          const profile = (message as any).profile;
          chrome.storage.local.set({ [STORAGE_KEYS.PROFILE]: profile }, () => {
            sendToPanel({ type: 'profileSaved' });
            sendResponse({ ok: true, profile });
          });
          break;
        }

        case 'getSkills': {
          chrome.storage.local.get([STORAGE_KEYS.SKILLS], (items) => {
            sendResponse({ ok: true, skills: items[STORAGE_KEYS.SKILLS] || [] });
          });
          break;
        }

        case 'upsertSkill': {
          const newSkill = (message as any).skill;
          chrome.storage.local.get([STORAGE_KEYS.SKILLS], (items) => {
            const current: any[] = items[STORAGE_KEYS.SKILLS] || [];
            const index = current.findIndex((s) => s.id === newSkill.id);
            if (index >= 0) {
              current[index] = { ...newSkill, updatedAt: Date.now() };
            } else {
              current.push({ ...newSkill, createdAt: Date.now(), updatedAt: Date.now() });
            }
            chrome.storage.local.set({ [STORAGE_KEYS.SKILLS]: current }, () => {
              sendToPanel({ type: 'skillSaved' });
              sendResponse({ ok: true, skills: current });
            });
          });
          break;
        }

        case 'deleteSkill': {
          const skillId = (message as any).id;
          chrome.storage.local.get([STORAGE_KEYS.SKILLS], (items) => {
            const current: any[] = items[STORAGE_KEYS.SKILLS] || [];
            const updated = current.filter((s) => s.id !== skillId);
            chrome.storage.local.set({ [STORAGE_KEYS.SKILLS]: updated }, () => {
              sendToPanel({ type: 'skillDeleted' });
              sendResponse({ ok: true, skills: updated });
            });
          });
          break;
        }

        case 'toggleLanguage': {
          const currentSettings = await getStoredSettings();
          const updated = { ...currentSettings, preferredLanguage: message.lang };
          chrome.storage.local.set(
            {
              [STORAGE_KEYS.SETTINGS]: updated,
              [STORAGE_KEYS.LANGUAGE]: message.lang
            },
            () => {
              sendToPanel({ type: 'settingsSaved' });
              sendResponse({ ok: true });
            }
          );
          break;
        }

        case 'clearSession': {
          chrome.storage.local.clear(() => {
            chrome.storage.local.set(
              {
                [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
                [STORAGE_KEYS.LANGUAGE]: DEFAULT_SETTINGS.preferredLanguage
              },
              () => {
                sendResponse({ ok: true });
              }
            );
          });
          break;
        }

        case 'screenshotCapture': {
          try {
            // Get the active tab
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!activeTab?.id || !activeTab?.windowId) {
              sendResponse({ ok: false, error: { code: 'ERR_TAB_NOT_FOUND', message: 'Could not find the active tab to screenshot.' } });
              break;
            }

            // Safety: block screenshot on sensitive pages (Phase 15 / SC-06)
            if (activeTab.url && isBlockedUrl(activeTab.url)) {
              sendResponse({
                ok: false,
                error: {
                  code: 'ERR_BLOCKED_PAGE',
                  message: 'Screenshots are disabled on sensitive pages (banking, login, payment) for privacy and security.'
                }
              });
              break;
            }

            // Capture the visible area of the active tab
            const dataUrl: string = await new Promise((resolve, reject) => {
              chrome.tabs.captureVisibleTab(
                activeTab.windowId,
                { format: 'png' },
                (url) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve(url);
                  }
                }
              );
            });

            // Send the screenshot data URL back to the panel
            sendToPanel({
              type: 'screenshotAnalysis',
              answer: dataUrl
            });

            sendResponse({ ok: true });
          } catch (screenshotErr: any) {
            const errMsg = screenshotErr?.message || 'Failed to capture screenshot.';
            sendToPanel({
              type: 'error',
              code: 'ERR_SCREENSHOT',
              message: errMsg
            });
            sendResponse({ ok: false, error: { code: 'ERR_SCREENSHOT', message: errMsg } });
          }
          break;
        }

        case 'screenshotAnalyse': {
          try {
            const settings = await getStoredSettings();
            if (!settings.apiKey) {
              sendResponse({
                ok: false,
                error: { code: 'ERR_NO_API_KEY', message: 'No Gemini API key found. Please open Settings and enter your key.' }
              });
              break;
            }

            const { question, dataUrl } = message as any;
            if (!dataUrl || !question) {
              sendResponse({ ok: false, error: { code: 'ERR_INVALID_INPUT', message: 'Missing screenshot or question.' } });
              break;
            }

            // Strip the data URL prefix to get pure base64
            const base64Match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
            if (!base64Match) {
              sendResponse({ ok: false, error: { code: 'ERR_INVALID_IMAGE', message: 'Invalid screenshot format.' } });
              break;
            }
            const mimeType = `image/${base64Match[1]}`;
            const base64Data = base64Match[2];
              // Use Gemini Flash vision model via direct fetch (inline image)
              const apiUrl = 
`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${settings.apiKey}`;
            const body = {
              contents: [{
                role: 'user',
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data
                    }
                  },
                  {
                    text: `Analyze this screenshot of a web page. Answer the following question using only what is visually present in the screenshot.\n\nIf the answer is not visible in the screenshot, say "I couldn't see that in the screenshot."\n\nQuestion: ${question}`
                  }
                ]
              }]
            };

            const visionRes = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });

            if (!visionRes.ok) {
              const errBody = await visionRes.json().catch(() => ({}));
              const errMsg = (errBody as any)?.error?.message || `Vision API error: ${visionRes.status}`;
              sendResponse({ ok: false, error: { code: 'ERR_VISION_API', message: errMsg } });
              break;
            }

            const visionData = await visionRes.json();
            const analysisText = visionData?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't analyse the screenshot.";

            sendResponse({ ok: true, text: analysisText });
          } catch (analyseErr: any) {
            const errMsg = analyseErr?.message || 'Failed to analyse screenshot.';
            sendResponse({ ok: false, error: { code: 'ERR_VISION_ANALYSIS', message: errMsg } });
          }
          break;
        }

        case 'scanElements': {
          try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!activeTab?.id) {
              sendResponse({ ok: false, error: 'No active tab found.' });
              break;
            }

            // Guard: restricted chrome:// or edge:// pages cannot run content scripts
            const tabUrl = activeTab.url || '';
            if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:') || tabUrl.startsWith('chrome-extension://')) {
              sendResponse({
                ok: false,
                error: 'Cannot scan browser internal pages (chrome://, edge://, etc.). Please navigate to a regular web page.'
              });
              break;
            }

            await ensureContentScript(activeTab.id);

            const scanRes = await chrome.tabs.sendMessage(activeTab.id, {
              type: 'scanElements',
              showBadges: (message as any).showBadges !== false
            });

            sendResponse(scanRes || { ok: false, error: 'No response from content script.' });
          } catch (scanErr: any) {
            sendResponse({ ok: false, error: scanErr?.message || 'Failed to scan elements.' });
          }
          break;
        }

        case 'toggleBadges': {
          try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!activeTab?.id) {
              sendResponse({ ok: false, error: 'No active tab found.' });
              break;
            }

            await ensureContentScript(activeTab.id);

            const show = (message as any).show !== false;
            const res = await chrome.tabs.sendMessage(activeTab.id, {
              type: show ? 'showBadges' : 'removeBadges'
            });

            sendResponse(res || { ok: true });
          } catch (badgeErr: any) {
            sendResponse({ ok: false, error: badgeErr?.message });
          }
          break;
        }

        case 'highlightElement': {
          try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!activeTab?.id) {
              sendResponse({ ok: false, error: 'No active tab found.' });
              break;
            }

            await ensureContentScript(activeTab.id);

            const res = await chrome.tabs.sendMessage(activeTab.id, {
              type: 'highlightElement',
              targetNumber: (message as any).targetNumber
            });

            sendResponse(res || { ok: false });
          } catch (hlErr: any) {
            sendResponse({ ok: false, error: hlErr?.message });
          }
          break;
        }

        case 'findIt': {
          try {
            const settings = await getStoredSettings();
            if (!settings.apiKey) {
              sendResponse({
                ok: false,
                error: {
                  code: 'ERR_NO_API_KEY',
                  message: 'No Gemini API key found. Please open Settings and enter your key.'
                }
              });
              break;
            }

            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!activeTab?.id) {
              sendResponse({ ok: false, error: { code: 'ERR_NO_TAB', message: 'No active tab found.' } });
              break;
            }

            const tabUrl = activeTab.url || '';
            if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:') || tabUrl.startsWith('chrome-extension://')) {
              sendResponse({
                ok: false,
                error: {
                  code: 'ERR_BLOCKED_PAGE',
                  message: 'Cannot interact with browser internal pages (chrome://, edge://, etc.). Please navigate to a regular web page.'
                }
              });
              break;
            }

            // 1. Ensure content script is running and scan elements
            await ensureContentScript(activeTab.id);
            const scanRes = await chrome.tabs.sendMessage(activeTab.id, {
              type: 'scanElements',
              showBadges: true
            });

            const elements = scanRes?.elements || [];
            if (!elements || elements.length === 0) {
              sendResponse({
                ok: false,
                error: {
                  code: 'ERR_NO_ELEMENTS',
                  message: 'No interactive elements were detected on this page.'
                }
              });
              break;
            }

            // 2. Build Find It prompt
            const prompt = buildFindItPrompt({
              question: (message as any).question,
              elements,
              language: settings.preferredLanguage
            });

            const intent: ModelIntent = { kind: 'find_it', difficulty: 'easy' };

            let findResult: any = null;
            let lastGenErr: any = null;

            // Up to 2 attempts for JSON compliance
            for (let attempt = 0; attempt < 2; attempt++) {
              const genResult = await generateText({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                intent,
                apiKey: settings.apiKey,
                groqApiKey: settings.groqApiKey,
                preferredTier: settings.modelTier,
                onRetry: (att, delaySec) => {
                  sendToPanel({ type: 'apiRetry', attempt: att, retryAfterSecs: delaySec });
                }
              });

              if (!genResult.success) {
                lastGenErr = genResult.error;
                break;
              }

              const extracted = extractJson(genResult.text);
              if (extracted.success) {
                const validated = validateWithSchema(FindItSchema, extracted.data);
                if (validated.success) {
                  findResult = validated.data;
                  break;
                }
              }
            }

            if (!findResult) {
              sendResponse({
                ok: false,
                error: lastGenErr || {
                  code: 'ERR_INVALID_JSON',
                  message: "I couldn't understand my instructions. Please rephrase your task."
                }
              });
              break;
            }

            // 3. Highlight the chosen target element on the web page if targetNumber found
            let targetLabel: string | undefined;
            if (findResult.targetNumber) {
              try {
                const hlRes = await chrome.tabs.sendMessage(activeTab.id, {
                  type: 'highlightElement',
                  targetNumber: findResult.targetNumber
                });
                targetLabel = hlRes?.label;
              } catch (e) {
                console.warn('Could not trigger highlight on page:', e);
              }
            }

            sendResponse({
              ok: true,
              result: {
                type: 'find',
                targetNumber: findResult.targetNumber,
                targetLabel:
                  targetLabel ||
                  elements.find((el: any) => el.number === findResult.targetNumber)?.label ||
                  undefined,
                reason: findResult.reason
              }
            });
          } catch (findErr: any) {
            sendResponse({
              ok: false,
              error: {
                code: 'ERR_FIND_FAILED',
                message: findErr?.message || 'Failed to locate element on page.'
              }
            });
          }
          break;
        }

        case 'agentStart': {
          try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!activeTab?.id) {
              sendResponse({ ok: false, error: 'No active browser tab found.' });
              break;
            }

            const tabUrl = activeTab.url || '';
            if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:') || tabUrl.startsWith('chrome-extension://')) {
              sendResponse({
                ok: false,
                error: 'Cannot run agent on browser internal pages (chrome://, edge://, etc.). Please switch to a regular web page.'
              });
              break;
            }

            const settings = await getStoredSettings();
            const session: AgentSession = {
              id: `session_${Date.now()}`,
              tabId: activeTab.id,
              url: activeTab.url || '',
              title: activeTab.title || 'Web Page',
              goal: (message as any).goal,
              steps: [],
              currentStepIndex: 0,
              stepLimit: settings.stepLimit || 15,
              dryRunEnabled: (message as any).dryRun || false,
              running: true,
              completed: false,
              startedAt: Date.now(),
              updatedAt: Date.now()
            };

            await saveSession(session);
            sendToPanel({ type: 'agentSessionLoaded', session });

            // Begin first step proposal
            const propRes = await proposeNextStep(session);
            sendResponse({ ok: propRes.ok, session, step: propRes.step, error: propRes.error });
          } catch (agentErr: any) {
            sendResponse({ ok: false, error: agentErr?.message || 'Failed to start agent.' });
          }
          break;
        }

        case 'agentNextStep': {
          try {
            const session = await getActiveSession();
            if (!session) {
              sendResponse({ ok: false, error: 'No active agent session found.' });
              break;
            }

            if (!session.running) {
              sendResponse({ ok: false, error: 'Agent session is currently stopped.' });
              break;
            }

            const propRes = await proposeNextStep(session);
            sendResponse({ ok: propRes.ok, step: propRes.step, error: propRes.error });
          } catch (err: any) {
            sendResponse({ ok: false, error: err?.message || 'Failed to propose next step.' });
          }
          break;
        }

        case 'agentDecide': {
          try {
            const session = await getActiveSession();
            if (!session || !session.running) {
              sendResponse({ ok: false, error: 'No running agent session.' });
              break;
            }

            const decision = (message as any).decision as 'approve' | 'skip' | 'stop';
            const currentStep = session.steps[session.steps.length - 1];

            if (!currentStep || currentStep.phase !== 'propose') {
              sendResponse({ ok: false, error: 'No pending step awaiting decision.' });
              break;
            }

            currentStep.decision = decision;

            if (decision === 'stop') {
              currentStep.phase = 'rejected';
              session.running = false;
              session.updatedAt = Date.now();
              await saveSession(session);
              sendToPanel({ type: 'agentSessionLoaded', session });
              sendResponse({ ok: true, session });
              break;
            }

            if (decision === 'skip') {
              currentStep.phase = 'skipped';
              session.updatedAt = Date.now();
              await saveSession(session);

              // Propose next step immediately
              const nextRes = await proposeNextStep(session);
              sendResponse({ ok: true, session, nextStep: nextRes.step });
              break;
            }

            if (decision === 'approve') {
              currentStep.phase = 'approved';

              // If action is done, finish session
              if (currentStep.action.type === 'done') {
                currentStep.executed = true;
                session.running = false;
                session.completed = true;
                session.updatedAt = Date.now();
                await saveSession(session);
                sendToPanel({ type: 'agentSessionLoaded', session });
                sendResponse({ ok: true, session, completed: true });
                break;
              }

              // Execute on web page via content script
              await ensureContentScript(session.tabId);
              let execResult: any;
              try {
                execResult = await chrome.tabs.sendMessage(session.tabId, {
                  type: 'executeAction',
                  action: currentStep.action,
                  dryRun: session.dryRunEnabled
                });
              } catch (msgErr: any) {
                execResult = { success: false, reason: msgErr?.message || 'Could not communicate with page.' };
              }

              if (execResult && execResult.success) {
                currentStep.executed = true;
                session.updatedAt = Date.now();
                await saveSession(session);

                // Small delay to let DOM settle after user-simulated action
                await new Promise((r) => setTimeout(r, 600));

                // Auto-advance: Propose next step
                const nextRes = await proposeNextStep(session);
                sendResponse({ ok: true, session, nextStep: nextRes.step });
              } else {
                currentStep.phase = 'failed';
                currentStep.errorMessage = execResult?.reason || 'Action execution failed.';
                session.updatedAt = Date.now();
                await saveSession(session);
                sendToPanel({ type: 'agentSessionLoaded', session });
                sendResponse({ ok: false, session, error: currentStep.errorMessage });
              }
            }
          } catch (decideErr: any) {
            sendResponse({ ok: false, error: decideErr?.message || 'Failed to process decision.' });
          }
          break;
        }

        case 'agentStop': {
          try {
            const session = await getActiveSession();
            if (session) {
              session.running = false;
              session.updatedAt = Date.now();
              await saveSession(session);
              sendToPanel({ type: 'agentSessionLoaded', session });
            }
            sendResponse({ ok: true });
          } catch (stopErr: any) {
            sendResponse({ ok: false, error: stopErr?.message });
          }
          break;
        }

        default:
          sendResponse({ ok: true, note: `Handled ${message.type}` });
          break;
      }
    })();

    return true; // async sendResponse
  });
}

// --- Phase 12: Cross-tab session sync & worker wake restoration ---
// Syncs session changes across windows/tabs and restores active sessions on worker wake.

/**
 * On service worker wake/reload, attempt to restore any active (running, non-completed)
 * AgentSession and notify the side panel so it can resume awaiting user approval.
 */
function restoreActiveSessionOnWake(): void {
  chrome.storage.local.get([STORAGE_KEYS.ACTIVE_SESSION_ID, STORAGE_KEYS.SESSIONS], (items) => {
    const activeId = items[STORAGE_KEYS.ACTIVE_SESSION_ID];
    const sessions = items[STORAGE_KEYS.SESSIONS] || {};
    const session =
      activeId && sessions[activeId] ? sessions[activeId] : null;

    if (session && session.running && !session.completed) {
      // Notify any open panel that a session was restored
      sendToPanel({ type: 'agentSessionLoaded', session });
    }
  });
}

/**
 * Storage change listener — keeps the panel in sync when session state mutates
 * from another context (e.g., a different window's agent action execution, or
 * the background worker rehydrating after sleep).
 */
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes[STORAGE_KEYS.SESSIONS] || changes[STORAGE_KEYS.ACTIVE_SESSION_ID]) {
      chrome.storage.local.get([STORAGE_KEYS.ACTIVE_SESSION_ID, STORAGE_KEYS.SESSIONS], (items) => {
        const activeId = items[STORAGE_KEYS.ACTIVE_SESSION_ID];
        const sessions = items[STORAGE_KEYS.SESSIONS] || {};
        if (activeId && sessions[activeId]) {
          sendToPanel({ type: 'agentSessionLoaded', session: sessions[activeId] });
        }
      });
    }
  });
}

// Restore on load
restoreActiveSessionOnWake();
