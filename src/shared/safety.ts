import { DetectedElement } from './types';

export const SENSITIVE_DOMAINS = [
  /^https?:\/\/(?:(?:www\.)?bank)?\d*\.bankof\w+\.com/i,
  /.*(?:bank|chase|wellsfargo|citi|hdfc|icici|sbi|axis|hsbc|barclays|fidelity|schwab)\.com/i,
  /.*\.(?:upi|payment|paypal|stripe|razorpay|paytm|gopay|phonepe|googlepay)\..*/i,
  /.*(?:login|signin|auth|account|sso)\..*/i,
  /.*\.onion/i
];

export const PROTECTED_PATHS = [
  /\/(checkout|cart|payment|billing|wallet|topup|recharge|fund|transfer|login|signin|authenticate|auth|password|reset-password)/i,
  /[?&](?:login|auth|token|otp|cvv|password|passphrase)=/i
];

export function isBlockedUrl(url: string): boolean {
  if (!url) return false;
  return (
    SENSITIVE_DOMAINS.some((re) => re.test(url)) ||
    PROTECTED_PATHS.some((re) => re.test(url))
  );
}

const PASSWORD_RE = /password|passphrase|pwd|secret|passcode|pin|security.?code/i;
const OTP_RE = /otp|one.?time|verify.?code|validation.?code|auth.?code|mfa|2fa/i;
const CARD_RE = /card|ccnumber|card.?number|cvv|expiry|exp.?date|cvc|pan|credit.?card|debit.?card/i;

export function isProtectedField(element: DetectedElement): boolean {
  const name = (element.attributes?.name || '').toLowerCase();
  const type = (element.type || '').toLowerCase();
  const attrType = (element.attributes?.type || '').toLowerCase();
  const label = (element.label || '').toLowerCase();
  const val = (element.value || '').toLowerCase();
  const placeholder = (element.attributes?.placeholder || '').toLowerCase();
  const ariaLabel = (element.attributes?.['aria-label'] || '').toLowerCase();
  const combined = `${name} ${label} ${attrType} ${placeholder} ${ariaLabel}`;

  if (type === 'password' || attrType === 'password') return true;
  if (PASSWORD_RE.test(combined)) return true;
  if (OTP_RE.test(combined)) return true;
  if (CARD_RE.test(`${combined} ${val}`)) return true;
  return false;
}

const CONSEQUENTIAL_SELECTORS = [
  /\bsubmit\b/i,
  /\bsend\b/i,
  /\bpay\b/i,
  /\bcheckout\b/i,
  /\bsave\b/i,
  /\bdelete\b/i,
  /\bremove\b/i,
  /\bcancel\b/i,
  /\bconfirm\b/i,
  /\bapprove\b/i,
  /\bpurchase\b/i,
  /\border\b/i,
  /\btransfer\b/i,
  /\bwithdraw\b/i,
  /\bexecute\b/i
];

export function isConsequential(element: DetectedElement): boolean {
  const text = `${element.label || ''} ${element.value || ''} ${element.attributes?.name || ''} ${element.attributes?.['aria-label'] || ''}`.toLowerCase();
  const sel = (element.selector || '').toLowerCase();
  return CONSEQUENTIAL_SELECTORS.some((re) => re.test(text) || re.test(sel));
}
