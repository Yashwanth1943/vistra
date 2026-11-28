export const FEEDBACK_CATEGORIES = [
  'Confusing behavior',
  'Bug report',
  'Feature idea',
  'Content feedback',
] as const;

export type FeedbackCategoryValue = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_MAX_LAB_LENGTH = 80;
export const FEEDBACK_MAX_DESCRIPTION_LENGTH = 1500;
export const FEEDBACK_MAX_BODY_BYTES = 4096;

function stripControlChars(input: string, allowNewlines: boolean): string {
  return allowNewlines
    ? input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    : input.replace(/[\x00-\x1F\x7F]/g, '');
}

export type FeedbackValidationResult =
  | {
      ok: true;
      data: {
        category: FeedbackCategoryValue;
        lab: string;
        description: string;
      };
    }
  | {
      ok: false;
      message: string;
    };

export function validateFeedbackInput(payload: Record<string, unknown>): FeedbackValidationResult {
  const rawCategory = payload.category;
  if (
    typeof rawCategory !== 'string' ||
    !FEEDBACK_CATEGORIES.includes(rawCategory as FeedbackCategoryValue)
  ) {
    return {
      ok: false,
      message: 'Please choose a valid feedback category.',
    };
  }

  const rawLab = payload.lab;
  if (typeof rawLab !== 'string') {
    return {
      ok: false,
      message: 'Lab context is required.',
    };
  }
  const lab = stripControlChars(rawLab, false).trim();
  if (!lab || lab.length > FEEDBACK_MAX_LAB_LENGTH) {
    return {
      ok: false,
      message: `Lab name must be between 1 and ${FEEDBACK_MAX_LAB_LENGTH} characters.`,
    };
  }

  const rawDescription = payload.description ?? '';
  if (typeof rawDescription !== 'string') {
    return {
      ok: false,
      message: 'Description must be plain text.',
    };
  }
  const description = stripControlChars(rawDescription, true).trim();
  if (description.length > FEEDBACK_MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message: `Description must be ${FEEDBACK_MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    };
  }

  return {
    ok: true,
    data: {
      category: rawCategory as FeedbackCategoryValue,
      lab,
      description,
    },
  };
}
