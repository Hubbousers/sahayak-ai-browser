/**
 * actions.ts — Content script action executor
 * NOTE: All types and helpers are defined inline here (no cross-directory imports)
 * to ensure content_script.js bundles as a self-contained file without external chunks.
 */

// ── Inline types (mirrors src/shared/types.ts) ──────────────────────────────
interface DetectedElement {
  id: string;
  number: number;
  type: 'button' | 'link' | 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'other';
  selector: string;
  label: string;
  attributes: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
  value?: string;
  options?: string[];
  disabled?: boolean;
  required?: boolean;
}

interface AgentAction {
  type: 'click' | 'type' | 'select' | 'scroll' | 'done' | 'none';
  targetNumber?: number;
  value?: string;
  direction?: 'up' | 'down';
  reason: string;
  confidence?: number;
  requiresExtraConfirm?: boolean;
}

// ── Inline safety helpers (mirrors src/shared/safety.ts) ────────────────────
const PASSWORD_RE = /password|passphrase|pwd|secret|passcode|pin/i;
const OTP_RE = /otp|one.?time|verify.?code|validation.?code/i;
const CARD_RE = /card|ccnumber|card.?number|cvv|expiry|cvc|pan/i;

function isProtectedField(element: DetectedElement): boolean {
  const name = (element.attributes?.name || '').toLowerCase();
  const type = (element.type || '').toLowerCase();
  const attrType = (element.attributes?.type || '').toLowerCase();
  const label = (element.label || '').toLowerCase();
  const val = (element.value || '').toLowerCase();

  if (type === 'password' || attrType === 'password') return true;
  if (PASSWORD_RE.test(name + ' ' + label + ' ' + attrType)) return true;
  if (OTP_RE.test(name + ' ' + label)) return true;
  if (CARD_RE.test(name + ' ' + label + ' ' + val)) return true;
  return false;
}

// ── Exported type ─────────────────────────────────────────────────────────────
export type ExecutionResult = { success: true; message?: string } | { success: false; reason: string };

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Dispatches synthetic input/change events so React/Vue/etc. detect programmatic
 * value assignments.
 */
function dispatchInputEvents(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  element.focus();
  element.value = value;

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  if (element instanceof HTMLInputElement && nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
  } else if (element instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
    nativeTextAreaValueSetter.call(element, value);
  }

  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}

function safeClick(el: HTMLElement, dryRun: boolean): ExecutionResult {
  if (dryRun) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return { success: true, message: 'Dry run: highlighted click target without triggering click.' };
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.focus();
  el.click();
  return { success: true };
}

function safeType(el: HTMLElement, value: string, dryRun: boolean, detectedInfo?: DetectedElement): ExecutionResult {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return { success: false, reason: 'Target element is not a text input or textarea.' };
  }
  if (detectedInfo && isProtectedField(detectedInfo)) {
    return { success: false, reason: 'This field is protected (password/OTP/payment) — I cannot type into it.' };
  }
  if ((el as HTMLInputElement).type === 'password') {
    return { success: false, reason: 'This field is a password field — typing is prohibited for security.' };
  }
  if (dryRun) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return { success: true, message: `Dry run: highlighted input without typing "${value}".` };
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  dispatchInputEvents(el, value);
  return { success: true };
}

function safeSelect(el: HTMLElement, value: string, dryRun: boolean): ExecutionResult {
  if (!(el instanceof HTMLSelectElement)) {
    return { success: false, reason: 'Target element is not a <select> element.' };
  }
  if (dryRun) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return { success: true, message: `Dry run: highlighted select without choosing "${value}".` };
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const valLower = value.toLowerCase().trim();
  let matchedIndex = -1;
  for (let i = 0; i < el.options.length; i++) {
    const opt = el.options[i];
    if (opt.value.toLowerCase().trim() === valLower || opt.text.toLowerCase().trim() === valLower) {
      matchedIndex = i;
      break;
    }
  }
  if (matchedIndex !== -1) {
    el.selectedIndex = matchedIndex;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }
  return { success: false, reason: `Option "${value}" was not found in the select dropdown.` };
}

function safeScroll(direction: 'up' | 'down' = 'down'): ExecutionResult {
  const scrollDistance = Math.round(window.innerHeight * 0.75);
  window.scrollBy({ top: direction === 'down' ? scrollDistance : -scrollDistance, behavior: 'smooth' });
  return { success: true };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function executePageAction(action: AgentAction, dryRun = false): Promise<ExecutionResult> {
  if (action.type === 'done') return { success: true, message: 'Goal accomplished.' };
  if (action.type === 'none') return { success: true, message: 'No action taken.' };
  if (action.type === 'scroll') return safeScroll(action.direction || 'down');

  if (!action.targetNumber) {
    return { success: false, reason: 'Missing target element number for action.' };
  }

  const elements: DetectedElement[] = (window as any).Sahayak?.elements || [];
  const item = elements.find((e) => e.number === action.targetNumber);
  if (!item) {
    return { success: false, reason: `Element #${action.targetNumber} was not found in current page map.` };
  }

  const el = document.querySelector(item.selector) as HTMLElement | null;
  if (!el) {
    return { success: false, reason: `Target DOM element #${action.targetNumber} (${item.label}) no longer exists on the page.` };
  }

  switch (action.type) {
    case 'click': return safeClick(el, dryRun);
    case 'type': return safeType(el, action.value || '', dryRun, item);
    case 'select': return safeSelect(el, action.value || '', dryRun);
    default: return { success: false, reason: `Unsupported action type: ${(action as any).type}` };
  }
}
