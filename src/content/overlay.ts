/**
 * overlay.ts — Badge and highlight rendering for scanned elements.
 * NOTE: Types are defined inline (no cross-directory imports) to ensure
 * content_script.js bundles as a self-contained file without external chunks.
 */

// ── Inline types ──────────────────────────────────────────────────────────────
interface DetectedElement {
  id: string;
  number: number;
  type: string;
  selector: string;
  label: string;
  attributes: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
  value?: string;
  options?: string[];
  disabled?: boolean;
  required?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const OVERLAY_CONTAINER_ID = 'sahayak-overlay-container';
const HIGHLIGHT_BOX_ID = 'sahayak-highlight-box';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateOverlayContainer(): HTMLDivElement {
  let container = document.getElementById(OVERLAY_CONTAINER_ID) as HTMLDivElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = OVERLAY_CONTAINER_ID;
    container.style.position = 'absolute';
    container.style.top = '0px';
    container.style.left = '0px';
    container.style.width = '100%';
    container.style.height = `${Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)}px`;
    container.style.pointerEvents = 'none';
    container.style.zIndex = '2147483640';
    container.style.overflow = 'visible';
    document.body.appendChild(container);
  }
  return container;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function removeBadges(): void {
  const container = document.getElementById(OVERLAY_CONTAINER_ID);
  if (container) container.remove();
  const highlight = document.getElementById(HIGHLIGHT_BOX_ID);
  if (highlight) highlight.remove();
}

export function renderBadges(elements: DetectedElement[]): void {
  removeBadges();
  const container = getOrCreateOverlayContainer();

  for (const item of elements) {
    const el = document.querySelector(item.selector);
    if (!el) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const top = rect.top + window.scrollY;
    const left = rect.left + window.scrollX;

    const badge = document.createElement('div');
    badge.className = 'sahayak-badge';
    badge.setAttribute('data-sahayak-num', item.number.toString());
    badge.textContent = item.number.toString();

    badge.style.position = 'absolute';
    badge.style.top = `${Math.max(0, top - 10)}px`;
    badge.style.left = `${Math.max(0, left - 6)}px`;
    badge.style.backgroundColor = '#f59e0b';
    badge.style.color = '#000000';
    badge.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '800';
    badge.style.lineHeight = '1';
    badge.style.padding = '3px 6px';
    badge.style.borderRadius = '4px';
    badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.3)';
    badge.style.pointerEvents = 'none';
    badge.style.zIndex = '2147483645';
    badge.style.userSelect = 'none';
    badge.style.transition = 'transform 0.15s ease';

    container.appendChild(badge);
  }
}

export function highlightElement(targetNumber: number): { success: boolean; label?: string } {
  const oldBox = document.getElementById(HIGHLIGHT_BOX_ID);
  if (oldBox) oldBox.remove();

  const elements: DetectedElement[] = (window as any).Sahayak?.elements || [];
  const targetItem = elements.find((e) => e.number === targetNumber);
  if (!targetItem) return { success: false };

  const el = document.querySelector(targetItem.selector);
  if (!el) return { success: false };

  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

  const rect = el.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const left = rect.left + window.scrollX;

  const box = document.createElement('div');
  box.id = HIGHLIGHT_BOX_ID;
  box.style.position = 'absolute';
  box.style.top = `${top - 4}px`;
  box.style.left = `${left - 4}px`;
  box.style.width = `${rect.width + 8}px`;
  box.style.height = `${rect.height + 8}px`;
  box.style.border = '3px solid #3b82f6';
  box.style.borderRadius = '6px';
  box.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
  box.style.boxShadow = '0 0 16px rgba(59, 130, 246, 0.6)';
  box.style.pointerEvents = 'none';
  box.style.zIndex = '2147483644';
  box.style.animation = 'sahayak-pulse 1.8s infinite';

  if (!document.getElementById('sahayak-anim-style')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'sahayak-anim-style';
    styleEl.textContent = `
      @keyframes sahayak-pulse {
        0% { transform: scale(1); opacity: 0.9; }
        50% { transform: scale(1.02); opacity: 0.6; }
        100% { transform: scale(1); opacity: 0.9; }
      }
    `;
    document.head.appendChild(styleEl);
  }

  document.body.appendChild(box);
  return { success: true, label: targetItem.label };
}
