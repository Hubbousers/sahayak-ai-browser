import { Readability } from '@mozilla/readability';

export interface ReadabilityResult {
  title: string;
  byline?: string;
  content: string; // sanitized HTML content
  textContent: string; // clean text content
  length: number;
  excerpt?: string;
  siteName?: string;
}

/**
 * Extracts clean readable article content from a DOM document,
 * stripping out navbars, headers, footers, sidebars, and ads.
 */
export function extractFromDocument(doc: Document = document): ReadabilityResult | null {
  try {
    // Clone document to prevent mutating the user's active page
    const documentClone = doc.cloneNode(true) as Document;

    // Remove known distraction elements prior to parsing
    const selectorsToRemove = [
      'nav',
      'header',
      'footer',
      'aside',
      '.advertisement',
      '.ad-banner',
      '#cookie-banner',
      '.cookie-notice',
      'script',
      'style',
      'noscript'
    ];

    selectorsToRemove.forEach((sel) => {
      documentClone.querySelectorAll(sel).forEach((el) => el.remove());
    });

    const reader = new Readability(documentClone, {
      charThreshold: 150,
      nbTopCandidates: 5
    });

    const article = reader.parse();

    if (!article || !article.textContent || article.textContent.trim().length < 50) {
      // Fallback: If Readability cannot identify an article body,
      // extract body paragraphs to avoid failing on minimal single-page layouts.
      const bodyText = Array.from(doc.querySelectorAll('article, main, p'))
        .map((el) => (el as HTMLElement).innerText?.trim() || '')
        .filter((t) => t.length > 20)
        .join('\n\n');

      if (bodyText.length > 80) {
        return {
          title: doc.title || 'Untitled Page',
          content: `<div>${bodyText}</div>`,
          textContent: bodyText,
          length: bodyText.length,
          siteName: window.location.hostname
        };
      }
      return null;
    }

    return {
      title: article.title || doc.title || 'Untitled',
      byline: article.byline || undefined,
      content: article.content || '',
      textContent: article.textContent.trim(),
      length: article.textContent.trim().length,
      excerpt: article.excerpt || undefined,
      siteName: article.siteName || window.location.hostname
    };
  } catch (error) {
    console.error('Sahayak Readability extraction error:', error);
    return null;
  }
}
