/**
 * Robust date formatting utilities for Kanvtech Service Management Platform
 * Safely handles strings, ISO dates, timestamps, null/undefined, and missing fields.
 * Returns clean 'N/A' fallback instead of 'Invalid Date'.
 */

export function parseDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

export function formatDateTime(value: any, fallback = 'N/A'): string {
  const d = parseDate(value);
  if (!d) return fallback;

  try {
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleString() || fallback;
  }
}

export function formatDate(value: any, fallback = 'N/A'): string {
  const d = parseDate(value);
  if (!d) return fallback;

  try {
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleDateString() || fallback;
  }
}

export function formatTime(value: any, fallback = 'N/A'): string {
  const d = parseDate(value);
  if (!d) return fallback;

  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleTimeString() || fallback;
  }
}

export function getDaysRemaining(expiryDate: any): number | null {
  const d = parseDate(expiryDate);
  if (!d) return null;
  const now = new Date();
  const diffTime = d.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
