import { z } from 'zod';

export function extractJson<T = unknown>(input: string): { success: true; data: T } | { success: false; error: string } {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Input is not a valid string.' };
  }

  // Look for markdown code fence ```json ... ``` or first balanced { ... } / [ ... ]
  const fenceMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonCandidate = fenceMatch ? fenceMatch[1].trim() : null;

  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate) as T;
      return { success: true, data: parsed };
    } catch {
      // Continue to next heuristic
    }
  }

  // Regex heuristic for balanced object or array
  const objectMatch = input.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[1].trim()) as T;
      return { success: true, data: parsed };
    } catch {
      // Fallback
    }
  }

  try {
    const directParse = JSON.parse(input.trim()) as T;
    return { success: true, data: directParse };
  } catch {
    return { success: false, error: 'Model did not return valid JSON.' };
  }
}

export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    };
  }
  return { success: true, data: result.data };
}
