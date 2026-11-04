import { z } from 'zod';

export const SummarySchema = z.object({
  tldr: z.string().min(5, 'TL;DR must be at least 5 characters long.'),
  keyPoints: z
    .array(z.string().min(3))
    .min(3, 'At least 3 key points required.')
    .max(7, 'At most 7 key points allowed.'),
  actions: z
    .array(z.string().min(3))
    .min(1, 'At least 1 action item or next step required.')
    .max(5, 'At most 5 action items allowed.')
});

export type StructuredSummaryOutput = z.infer<typeof SummarySchema>;

export function buildArticleSummaryPrompt(params: {
  title: string;
  articleText: string;
  language: 'en' | 'hi';
}): string {
  const languageInstruction =
    params.language === 'hi'
      ? 'Respond in Hinglish (Hindi written in Roman script, naturally blended with English technical and common terms).'
      : 'Respond in clear, accessible English.';

  // Truncate text to avoid token limits while retaining full article context
  const textTruncated =
    params.articleText.length > 25000
      ? params.articleText.slice(0, 25000) + '... [content truncated]'
      : params.articleText;

  return `You are Sahayak, an intelligent reading assistant.
Summarize the following web article.

Title: "${params.title}"
Content:
"""
${textTruncated}
"""

Rules:
1. ${languageInstruction}
2. Extract the core essence without generic filler.
3. Return STRICT JSON with no other commentary or markdown around it.

JSON Schema:
{
  "tldr": "A compelling 1-2 sentence core takeaway",
  "keyPoints": [
    "Key insight 1",
    "Key insight 2",
    "Key insight 3",
    "Key insight 4",
    "Key insight 5"
  ],
  "actions": [
    "Next step or practical takeaway 1",
    "Next step or practical takeaway 2",
    "Next step or practical takeaway 3"
  ]
}`;
}

export const YouTubeSummarySchema = z.object({
  tldr: z.string().min(5, 'TL;DR must be at least 5 characters long.'),
  keyPoints: z
    .array(z.string().min(3))
    .min(3, 'At least 3 key points required.')
    .max(7, 'At most 7 key points allowed.'),
  chapters: z
    .array(
      z.object({
        label: z.string().min(2),
        seconds: z.number().int().min(0),
        snippet: z.string().optional()
      })
    )
    .default([]),
  actions: z
    .array(z.string().min(3))
    .min(1, 'At least 1 action item required.')
    .max(5, 'At most 5 action items allowed.')
});

export type YouTubeSummaryOutput = z.infer<typeof YouTubeSummarySchema>;

export function buildYouTubeSummaryPrompt(params: {
  title: string;
  transcript: string;
  hasTranscript: boolean;
  language: 'en' | 'hi';
}): string {
  const languageInstruction =
    params.language === 'hi'
      ? 'Respond in Hinglish (Hindi written in Roman script, naturally blended with English terms).'
      : 'Respond in clear, accessible English.';

  const transcriptSection = params.hasTranscript
    ? `Video Transcript with Timestamps:\n"""\n${params.transcript.slice(0, 25000)}\n"""`
    : `Note: Full timed transcript was unavailable for this video. Summarize based on the title and public topic context. Leave chapters empty if exact seconds are unknown.`;

  return `You are Sahayak, an intelligent media reading assistant.
Summarize this YouTube video.

Video Title: "${params.title}"
${transcriptSection}

Rules:
1. ${languageInstruction}
2. Extract the core essence and key concepts covered in the video.
3. Group major topic shifts into timestamped chapters using the [seconds] cues from transcript where available.
4. Return STRICT JSON with no other commentary or markdown around it.

JSON Schema:
{
  "tldr": "A compelling 1-2 sentence core takeaway of the video",
  "keyPoints": [
    "Key discussion point 1",
    "Key discussion point 2",
    "Key discussion point 3",
    "Key discussion point 4",
    "Key discussion point 5"
  ],
  "chapters": [
    { "label": "Chapter or topic description", "seconds": 0, "snippet": "Brief detail" },
    { "label": "Next topic", "seconds": 45, "snippet": "Brief detail" }
  ],
  "actions": [
    "Practical takeaway or next step 1",
    "Practical takeaway or next step 2",
    "Practical takeaway or next step 3"
  ]
}`;
}

export function buildPageChatPrompt(params: {
  pageTitle: string;
  pageContent: string;
  question: string;
  conversationHistory?: Array<{ sender: 'user' | 'assistant'; text: string }>;
  language: 'en' | 'hi';
}): string {
  const languageInstruction =
    params.language === 'hi'
      ? 'Respond in Hinglish (Hindi written in Roman script, natural mix with English terms).'
      : 'Respond in clear, natural English.';

  const truncatedContent =
    params.pageContent.length > 25000
      ? params.pageContent.slice(0, 25000) + '... [content truncated]'
      : params.pageContent;

  const historySection =
    params.conversationHistory && params.conversationHistory.length > 0
      ? 'Recent conversation history:\n' +
        params.conversationHistory
          .slice(-6)
          .map((m) => `${m.sender === 'user' ? 'User' : 'Sahayak'}: ${m.text}`)
          .join('\n') +
        '\n\n'
      : '';

  return `You are Sahayak, an AI browser assistant.
Answer the user's question using ONLY the content of the current page below.
Grounding Rule: If the answer is not present or cannot be determined strictly from the provided page content, you MUST reply: "I couldn't find this in the current page."
Do NOT invent facts, names, dates, numbers, or external links. Answer accurately, concisely, and helpfully.

Page Title: "${params.pageTitle}"
Page Content:
"""
${truncatedContent}
"""

${historySection}User Question: "${params.question}"

${languageInstruction}`;
}

export const FindItSchema = z.object({
  type: z.literal('find'),
  targetNumber: z.number().int().min(1).nullable(),
  reason: z.string().min(3).max(200)
});

export type FindItOutput = z.infer<typeof FindItSchema>;

export function buildFindItPrompt(params: {
  question: string;
  elements: Array<{
    number: number;
    type: string;
    label: string;
    selector: string;
    value?: string;
  }>;
  language: 'en' | 'hi';
}): string {
  const languageInstruction =
    params.language === 'hi'
      ? 'Explain the reason in Hinglish (Hindi written in Roman script).'
      : 'Explain the reason in clear, concise English.';

  const elementLines = params.elements
    .map(
      (el) =>
        `[#${el.number}] Type: ${el.type} | Label: "${el.label}" | Selector: ${el.selector}${
          el.value ? ` | Current Value: "${el.value}"` : ''
        }`
    )
    .join('\n');

  return `You are Sahayak, an intelligent web element finder.
The user is looking for a specific interactive element on the current web page.

User Question/Request:
"${params.question}"

Numbered Interactive Elements on the Page:
"""
${elementLines}
"""

Rules:
1. Examine the list of numbered elements carefully.
2. Select the EXACT targetNumber (integer 1..N) that best answers or satisfies the user's intent.
3. If no element on the page matches the user's request, set targetNumber to null and state in the reason that the element was not found.
4. ${languageInstruction} Keep the reason to 1 brief, helpful sentence.
5. Return ONLY a strict JSON object with this exact schema:

{
  "type": "find",
  "targetNumber": 12,
  "reason": "The file input for uploading resumes and CV documents."
}`;
}

export const AgentActionSchema = z.object({
  type: z.enum(['click', 'type', 'select', 'scroll', 'done', 'none']),
  targetNumber: z.number().int().min(1).optional(),
  value: z.string().optional(),
  direction: z.enum(['up', 'down']).optional(),
  reason: z.string().min(3).max(200),
  confidence: z.number().min(0).max(1).optional(),
  requiresExtraConfirm: z.boolean().optional().default(false)
});

export type AgentActionOutput = z.infer<typeof AgentActionSchema>;

export function buildAgentNextStepPrompt(params: {
  goal: string;
  elements: Array<{
    number: number;
    type: string;
    label: string;
    selector: string;
    value?: string;
  }>;
  executedSteps: Array<{
    action: { type: string; targetNumber?: number; value?: string; direction?: string };
    reason: string;
  }>;
  profile?: {
    name?: string;
    college?: string;
    skills?: string[];
    links?: string[];
  };
  language: 'en' | 'hi';
}): string {
  const languageInstruction =
    params.language === 'hi'
      ? 'Explain the reason in Hinglish (Hindi written in Roman script).'
      : 'Explain the reason in clear, concise English.';

  const elementLines = params.elements
    .map(
      (el) =>
        `[#${el.number}] Type: ${el.type} | Label: "${el.label}" | Selector: ${el.selector}${
          el.value ? ` | Current Value: "${el.value}"` : ''
        }`
    )
    .join('\n');

  const historyLines =
    params.executedSteps.length > 0
      ? params.executedSteps
          .map(
            (s, idx) =>
              `${idx + 1}. Action: ${s.action.type}${
                s.action.targetNumber ? ` on #${s.action.targetNumber}` : ''
              }${s.action.value ? ` with value "${s.action.value}"` : ''} - Reason: ${s.reason}`
          )
          .join('\n')
      : 'None yet (first step).';

  const profileContext = params.profile
    ? `User Profile Data Available for Form-filling:
- Name: "${params.profile.name || ''}"
- College: "${params.profile.college || ''}"
- Skills: ${params.profile.skills?.join(', ') || ''}
- Links/Portfolios: ${params.profile.links?.join(', ') || ''}`
    : 'No profile data provided.';

  return `You are Sahayak, an autonomous web assistant.
You operate ONE STEP AT A TIME. Each single action you propose will be shown to the user for explicit approval before execution.

User Overall Goal:
"${params.goal}"

${profileContext}

Steps Executed So Far:
${historyLines}

Currently Visible Interactive Elements:
"""
${elementLines}
"""

Rules:
1. Propose ONLY the immediate NEXT SINGLE step towards achieving the goal.
2. Supported action types:
   - "type": requires targetNumber and value. (NEVER type into passwords or credit cards).
   - "click": requires targetNumber.
   - "select": requires targetNumber and exact option text value.
   - "scroll": requires direction ("up" or "down").
   - "done": when the user goal is completely achieved.
3. ${languageInstruction} Keep the reason to 1 clear, friendly sentence.
4. If this action is consequential (submitting a form, deleting, confirming payment, or completing application), set requiresExtraConfirm to true.
5. Return ONLY a strict JSON object with this schema:

{
  "type": "type",
  "targetNumber": 2,
  "value": "Tarun Kumar",
  "reason": "Filling in your full name into the applicant name field.",
  "confidence": 0.95,
  "requiresExtraConfirm": false
}`;
}
