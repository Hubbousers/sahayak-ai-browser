/**
 * scanner.ts — Interactive DOM element scanner.
 * NOTE: Types are defined inline (no cross-directory imports) to ensure
 * content_script.js bundles as a self-contained file without external chunks.
 */

// ── Inline types ──────────────────────────────────────────────────────────────
interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectedElement {
  id: string;
  number: number;
  type: 'button' | 'link' | 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'other';
  selector: string;
  label: string;
  attributes: Record<string, string>;
  rect: ElementRect;
  value?: string;
  options?: string[];
  disabled?: boolean;
  required?: boolean;
}

// ── Selector computation ──────────────────────────────────────────────────────

/**
 * Computes a robust, stable CSS selector for a given DOM element.
 * Prioritizes id, name, unique attributes, test-ids, and falls back to nth-of-type path.
 */
export function computeStableSelector(el: Element): string {
  if (el.id && !/^\d/.test(el.id) && !el.id.includes(':')) {
    return `#${CSS.escape(el.id)}`;
  }

  const testId = el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  const name = el.getAttribute('name');
  const tagName = el.tagName.toLowerCase();
  if (name && (tagName === 'input' || tagName === 'textarea' || tagName === 'select')) {
    return `${tagName}[name="${CSS.escape(name)}"]`;
  }

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim().length < 50) {
    return `${tagName}[aria-label="${CSS.escape(ariaLabel.trim())}"]`;
  }

  const path: string[] = [];
  let current: Element | null = el;

  while (
    current &&
    current.nodeType === Node.ELEMENT_NODE &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    const curTag = current.tagName.toLowerCase();
    let siblingIndex = 1;
    let sibling = current.previousElementSibling;

    while (sibling) {
      if (sibling.tagName.toLowerCase() === curTag) siblingIndex++;
      sibling = sibling.previousElementSibling;
    }

    path.unshift(`${curTag}:nth-of-type(${siblingIndex})`);
    if (path.length >= 4) break;
    current = current.parentElement;
  }

  return path.join(' > ');
}

// ── Label extraction ──────────────────────────────────────────────────────────

export function extractLabel(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl && labelEl.textContent?.trim()) return labelEl.textContent.trim();
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.textContent?.trim()) return label.textContent.trim();
    }
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.textContent?.trim()) return parentLabel.textContent.trim();
    if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.placeholder) {
      return el.placeholder.trim();
    }
  }

  const title = el.getAttribute('title');
  if (title && title.trim()) return title.trim();

  const alt = el.getAttribute('alt');
  if (alt && alt.trim()) return alt.trim();

  const text = el.textContent?.trim();
  if (text) return text.length > 80 ? text.slice(0, 77) + '...' : text;

  if (el instanceof HTMLInputElement && el.value) return el.value.trim();

  return el.getAttribute('name') || el.tagName.toLowerCase();
}

// ── Element classification ────────────────────────────────────────────────────

export function classifyElement(el: Element): DetectedElement['type'] {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || el.getAttribute('role') === 'button') return 'button';
  if (tag === 'a' && el.hasAttribute('href')) return 'link';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select' || el.getAttribute('role') === 'combobox') return 'select';

  if (tag === 'input') {
    const inputType = (el.getAttribute('type') || 'text').toLowerCase();
    if (inputType === 'checkbox' || el.getAttribute('role') === 'checkbox') return 'checkbox';
    if (inputType === 'radio' || el.getAttribute('role') === 'radio') return 'radio';
    if (inputType === 'button' || inputType === 'submit' || inputType === 'reset') return 'button';
    return 'input';
  }

  return 'other';
}

// ── Visibility check ──────────────────────────────────────────────────────────

function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return false;

  const style = window.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    style.pointerEvents === 'none'
  ) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (rect.bottom < -500 || rect.top > window.innerHeight + 5000) return false;

  return true;
}

// ── Main scanner ──────────────────────────────────────────────────────────────

/**
 * Scans the current page for interactive elements, assigns stable 1..N numbers,
 * and returns structured DetectedElement items. Also stores them on window.Sahayak.
 */
export function scanPageElements(): DetectedElement[] {
  const selector = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'textarea',
    'select',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="combobox"]',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  const rawElements = Array.from(document.querySelectorAll(selector));
  const seenSelectors = new Set<string>();
  const detected: DetectedElement[] = [];
  let numberCounter = 1;

  for (const el of rawElements) {
    if (!isElementVisible(el)) continue;

    const type = classifyElement(el);
    const selectorStr = computeStableSelector(el);

    if (seenSelectors.has(selectorStr)) continue;
    seenSelectors.add(selectorStr);

    const rect = el.getBoundingClientRect();
    const label = extractLabel(el);

    const attributes: Record<string, string> = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (['id', 'name', 'type', 'placeholder', 'role', 'aria-label', 'href'].includes(attr.name)) {
        attributes[attr.name] = attr.value;
      }
    }

    let value: string | undefined;
    let options: string[] | undefined;
    let disabled = false;
    let required = false;

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      value = el.value;
      disabled = el.disabled;
      required = el.required;
    } else if (el instanceof HTMLSelectElement) {
      value = el.value;
      options = Array.from(el.options).map((opt) => opt.text.trim());
      disabled = el.disabled;
      required = el.required;
    }

    detected.push({
      id: selectorStr,
      number: numberCounter++,
      type,
      selector: selectorStr,
      label,
      attributes,
      rect: {
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      value,
      options,
      disabled,
      required
    });

    if (detected.length >= 60) break;
  }

  // Store element reference map on window.Sahayak for live DOM interaction
  if (typeof window !== 'undefined') {
    (window as any).Sahayak = (window as any).Sahayak || {};
    (window as any).Sahayak.elements = detected;
  }

  return detected;
}
