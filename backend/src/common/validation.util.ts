import { BadRequestException } from '@nestjs/common';

export function validateEmail(email?: string | null, fieldName = 'Email'): string {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new BadRequestException(`${fieldName} is required.`);
  }
  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (normalized.length < 5 || normalized.length > 191 || !emailRegex.test(normalized)) {
    throw new BadRequestException(`Please enter a valid email address for ${fieldName} (e.g., name@company.com).`);
  }
  return normalized;
}

export function validateOptionalEmail(email?: string | null, fieldName = 'Email'): string | null {
  if (!email || typeof email !== 'string' || !email.trim()) return null;
  return validateEmail(email, fieldName);
}

export function validatePhone(phone?: string | null, fieldName = 'Contact phone'): string {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    throw new BadRequestException(`${fieldName} is required.`);
  }
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 10 || digits.length > 15) {
    throw new BadRequestException(
      `${fieldName} must be a valid 10 to 15 digit phone number (e.g. 9876543210 or +91 98765 43210).`,
    );
  }

  // Reject all repetitive single-digit sequences (e.g. 0000000000, 88888888888888888888)
  if (/^(\d)\1+$/.test(digits)) {
    throw new BadRequestException(
      `${fieldName} cannot be a repetitive dummy number. Please enter a genuine phone number.`,
    );
  }

  return trimmed;
}

export function validateOptionalPhone(phone?: string | null, fieldName = 'Phone'): string | null {
  if (!phone || typeof phone !== 'string' || !phone.trim()) return null;
  return validatePhone(phone, fieldName);
}

export function validateOptionalGSTN(gstn?: string | null): string | null {
  if (!gstn || typeof gstn !== 'string' || !gstn.trim()) return null;
  const trimmed = gstn.trim().toUpperCase();
  const gstnRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstnRegex.test(trimmed)) {
    throw new BadRequestException('Please enter a valid 15-character GSTIN (e.g., 27AABCU9603R1ZM).');
  }
  return trimmed;
}
