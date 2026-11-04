// Sahayak Content Script
import { extractFromDocument } from './readability';
import { scanPageElements } from './scanner';
import { renderBadges, removeBadges, highlightElement } from './overlay';
import { executePageAction } from './actions';

console.log('Sahayak content script loaded on:', window.location.href);

// Listen for messages from background or panel
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'ping':
        sendResponse({ status: 'alive', url: window.location.href });
        break;

      case 'getArticleContent': {
        const article = extractFromDocument(document);
        sendResponse({
          ok: !!article,
          article,
          url: window.location.href,
          title: document.title
        });
        break;
      }

      case 'scanElements': {
        try {
          const elements = scanPageElements();
          if (message.showBadges !== false) {
            renderBadges(elements);
          }
          sendResponse({
            ok: true,
            elements,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight
            },
            url: window.location.href,
            title: document.title
          });
        } catch (err: any) {
          sendResponse({ ok: false, error: err?.message || 'Failed to scan page elements.' });
        }
        break;
      }

      case 'showBadges': {
        try {
          const elements = scanPageElements();
          renderBadges(elements);
          sendResponse({ ok: true, count: elements.length });
        } catch (err: any) {
          sendResponse({ ok: false, error: err?.message });
        }
        break;
      }

      case 'removeBadges': {
        removeBadges();
        sendResponse({ ok: true });
        break;
      }

      case 'highlightElement': {
        const res = highlightElement(message.targetNumber);
        sendResponse(res);
        break;
      }

      case 'executeAction': {
        executePageAction(message.action, message.dryRun)
          .then((result) => sendResponse(result))
          .catch((err) => sendResponse({ success: false, reason: err?.message || 'Execution failed.' }));
        return true; // asynchronous
      }

      default:
        sendResponse({ ok: true });
        break;
    }
    return true; // asynchronous response
  });
}
