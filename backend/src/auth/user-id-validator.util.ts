/**
 * Kanvtech Custom User ID Validation & Normalization Utility
 * Enforces platform-wide format, length, reserved words, and case-insensitive normalization.
 */

export const SYSTEM_RESERVED_USER_IDS = new Set([
  'admin',
  'administrator',
  'system',
  'root',
  'superuser',
  'kanvtech',
  'support',
  'helpdesk',
  'api',
  'null',
  'undefined',
  'anonymous',
  'guest',
  'security',
  'billing',
  'contact',
  'owner',
  'master',
]);

const USER_ID_REGEX = /^[a-zA-Z0-9._-]+$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 40;

export interface UserIdValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

/**
 * Validates and normalizes a candidate Custom User ID.
 * Returns normalized string in lowercase with leading/trailing spaces trimmed.
 */
export function validateAndNormalizeUserId(rawId?: string | null): UserIdValidationResult {
  if (rawId === null || rawId === undefined) {
    return { valid: false, normalized: '', error: 'User ID cannot be blank.' };
  }

  const trimmed = String(rawId).trim();
  if (trimmed.length === 0) {
    return { valid: false, normalized: '', error: 'User ID cannot be blank.' };
  }

  if (trimmed.length < MIN_LENGTH) {
    return {
      valid: false,
      normalized: trimmed.toLowerCase(),
      error: `User ID must be at least ${MIN_LENGTH} characters long.`,
    };
  }

  if (trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      normalized: trimmed.toLowerCase(),
      error: `User ID cannot exceed ${MAX_LENGTH} characters.`,
    };
  }

  if (!USER_ID_REGEX.test(trimmed)) {
    return {
      valid: false,
      normalized: trimmed.toLowerCase(),
      error: 'User ID can only contain letters, numbers, periods (.), underscores (_), and hyphens (-).',
    };
  }

  const normalized = trimmed.toLowerCase();

  if (SYSTEM_RESERVED_USER_IDS.has(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'The requested User ID is reserved and cannot be assigned.',
    };
  }

  return { valid: true, normalized };
}
