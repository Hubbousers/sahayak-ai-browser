/**
 * practiceTasks.ts — Curated practice task templates for Phase 13.
 *
 * These tasks are designed for safe, controlled end-to-end agent testing.
 * Each task provides a ready-made goal string and context for the agent.
 */

import { PracticeTask } from '../shared/types';

export const PRACTICE_TASKS: PracticeTask[] = [
  // ── Form Fill ──────────────────────────────────────────────────────────────
  {
    id: 'pt-form-internship',
    name: 'Internship Application Form',
    category: 'form-fill',
    description: 'Fill a multi-step internship or job application form using profile data.',
    goalTemplate:
      'Fill out the internship application form on this page using my profile. ' +
      'Type my name, email, skills, and any other fields that match my profile. ' +
      'Do NOT submit the form — stop before hitting any submit button.',
    icon: '📝',
    safetyNote: 'Agent will pause before Submit. You must approve every field.'
  },
  {
    id: 'pt-form-contact',
    name: 'Contact / Feedback Form',
    category: 'form-fill',
    description: 'Fill a contact or feedback form with name, email, and a short message.',
    goalTemplate:
      'Fill the contact or feedback form on this page. ' +
      'Use my name and email from my profile. For the message field, write a short polite inquiry. ' +
      'Do NOT submit — stop before any submit or send button.',
    icon: '✉️',
    safetyNote: 'Agent pauses before Submit. Approve each field individually.'
  },
  {
    id: 'pt-form-signup',
    name: 'Sign-up / Registration Form',
    category: 'form-fill',
    description: 'Fill a registration form with name and email. Skips password fields automatically.',
    goalTemplate:
      'Fill the registration or sign-up form on this page. ' +
      'Use my name and email from my profile. ' +
      'Skip any password or OTP fields — those are protected. ' +
      'Do NOT click the submit or register button.',
    icon: '🔐',
    safetyNote: 'Password/OTP fields are automatically skipped by safety rules.'
  },

  // ── Shop Search ────────────────────────────────────────────────────────────
  {
    id: 'pt-shop-search-laptop',
    name: 'Search & Filter: Laptops',
    category: 'shop-search',
    description: 'Search for laptops on a shop page and apply a price or category filter.',
    goalTemplate:
      'On this shopping page, search for "laptop" in the search box. ' +
      'After results appear, apply a price filter or sort by "Price: Low to High" if available. ' +
      'Do not add anything to the cart.',
    icon: '💻',
    safetyNote: 'Agent will not add items to cart or checkout.'
  },
  {
    id: 'pt-shop-search-books',
    name: 'Search & Filter: Books',
    category: 'shop-search',
    description: 'Search for a book topic and filter by rating or category.',
    goalTemplate:
      'On this shopping page, search for "programming books" in the search box. ' +
      'After results appear, if a rating filter is available, filter by 4 stars and above. ' +
      'Do not add anything to the cart or proceed to checkout.',
    icon: '📚',
    safetyNote: 'Agent will not add items to cart or checkout.'
  },

  // ── Data Collection ────────────────────────────────────────────────────────
  {
    id: 'pt-collect-products',
    name: 'Collect Product List',
    category: 'data-collection',
    description: 'Read visible product names and prices from the current page into a table.',
    goalTemplate:
      'Collect all visible product names and their prices from the current page. ' +
      'Scroll down to reveal more items if needed. ' +
      'After collecting items from this page, click "Next Page" if available and collect from page 2 as well. ' +
      'Stop after 2 pages or when there is no next page.',
    icon: '📊',
    safetyNote: 'Data collection only — no cart or checkout actions.'
  },
  {
    id: 'pt-collect-jobs',
    name: 'Collect Job Listings',
    category: 'data-collection',
    description: 'Scan job title, company, and location from a job listing page.',
    goalTemplate:
      'On this job listings page, collect all visible job titles, company names, and locations. ' +
      'Scroll down if needed to reveal more listings. ' +
      'Stop when you have collected at least 5 jobs or reached the bottom of the page.',
    icon: '💼',
    safetyNote: 'Read-only scan. No applications or form submissions.'
  }
];

export const TASK_CATEGORY_LABELS: Record<string, string> = {
  'form-fill': 'Form Fill',
  'shop-search': 'Shop & Search',
  'data-collection': 'Data Collection'
};

export const TASK_CATEGORY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  'form-fill': { color: '#fcd34d', bg: '#451a03', border: '#92400e' },
  'shop-search': { color: '#86efac', bg: '#052e16', border: '#166534' },
  'data-collection': { color: '#93c5fd', bg: '#0c1a35', border: '#1d4ed8' }
};
