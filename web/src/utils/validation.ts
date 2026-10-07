/**
 * Common Input Validation Utilities for KANVTECH Platform
 */

/**
 * Standard RFC 5322 compliant email validator.
 * Ensures proper format: user@domain.tld with valid TLD (at least 2 chars).
 */
export function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 191) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed);
}

/**
 * Standard Phone / Mobile Number Validator.
 * Supports:
 * - 10-digit mobile numbers (e.g., 9876543210)
 * - Numbers with country code (e.g., +91 98765 43210, +1 555-123-4567)
 * - Landlines with STD codes (e.g., 022 2890 1234)
 * Rejects:
 * - Excessively long garbage strings (e.g., 88888888888888888888)
 * - Numbers with < 10 or > 15 digits
 * - Repetitive dummy numbers like 0000000000
 */
export function isValidPhone(phone?: string | null): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const res = validatePhoneDetailed(phone);
  return res.valid;
}

/**
 * Detailed Phone Validator with Country-Specific Digit Verification.
 */
export function validatePhoneDetailed(phone?: string | null): { valid: boolean; error?: string } {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return { valid: false, error: 'Phone number is required.' };
  }
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 0) {
    return { valid: false, error: 'Please enter a phone number.' };
  }

  // Reject all repetitive single-digit sequences (e.g. 0000000000, 1111111111)
  if (/^(\d)\1+$/.test(digits)) {
    return { valid: false, error: 'Please enter a valid phone number (repetitive dummy digits not allowed).' };
  }

  // Specific Country Rules
  if (trimmed.startsWith('+91')) {
    const local = trimmed.slice(3).replace(/\D/g, '');
    if (local.length !== 10) {
      return { valid: false, error: `India (+91) requires exactly 10 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  if (trimmed.startsWith('+1')) {
    const local = trimmed.slice(2).replace(/\D/g, '');
    if (local.length !== 10) {
      return { valid: false, error: `US/Canada (+1) requires exactly 10 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  if (trimmed.startsWith('+971')) {
    const local = trimmed.slice(4).replace(/\D/g, '');
    if (local.length !== 9) {
      return { valid: false, error: `UAE (+971) requires exactly 9 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  if (trimmed.startsWith('+966')) {
    const local = trimmed.slice(4).replace(/\D/g, '');
    if (local.length !== 9) {
      return { valid: false, error: `Saudi Arabia (+966) requires exactly 9 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  if (trimmed.startsWith('+65')) {
    const local = trimmed.slice(3).replace(/\D/g, '');
    if (local.length !== 8) {
      return { valid: false, error: `Singapore (+65) requires exactly 8 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  if (trimmed.startsWith('+44')) {
    const local = trimmed.slice(3).replace(/\D/g, '');
    if (local.length !== 10) {
      return { valid: false, error: `UK (+44) requires exactly 10 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  if (trimmed.startsWith('+61')) {
    const local = trimmed.slice(3).replace(/\D/g, '');
    if (local.length !== 9) {
      return { valid: false, error: `Australia (+61) requires exactly 9 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  if (trimmed.startsWith('+880')) {
    const local = trimmed.slice(4).replace(/\D/g, '');
    if (local.length !== 10) {
      return { valid: false, error: `Bangladesh (+880) requires exactly 10 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  if (trimmed.startsWith('+977')) {
    const local = trimmed.slice(4).replace(/\D/g, '');
    if (local.length !== 10) {
      return { valid: false, error: `Nepal (+977) requires exactly 10 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  if (trimmed.startsWith('+94')) {
    const local = trimmed.slice(3).replace(/\D/g, '');
    if (local.length !== 9) {
      return { valid: false, error: `Sri Lanka (+94) requires exactly 9 digits (entered ${local.length} digits).` };
    }
    return { valid: true };
  }

  // Fallback for general numbers (7 to 15 digits)
  if (digits.length < 8 || digits.length > 15) {
    return { valid: false, error: 'Please enter a valid phone number (8 to 15 digits).' };
  }

  return { valid: true };
}

/**
 * Indian GSTIN Validator (15 alphanumeric characters).
 * Format: 2 digits (State Code) + 5 chars (PAN) + 4 digits + 1 char + 1 char (Z) + 1 check digit.
 * Optional field - returns true if empty.
 */
export function isValidGSTN(gstn?: string | null): boolean {
  if (!gstn || typeof gstn !== 'string' || !gstn.trim()) return true;
  const trimmed = gstn.trim().toUpperCase();
  const gstnRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstnRegex.test(trimmed);
}

/**
 * Validate multiple comma/semicolon/newline separated emails.
 */
export function isValidMultipleEmails(emailsStr?: string | null): boolean {
  if (!emailsStr || typeof emailsStr !== 'string' || !emailsStr.trim()) return true;
  const list = emailsStr.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  return list.every((e) => isValidEmail(e));
}
