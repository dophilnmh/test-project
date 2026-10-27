const NAIROBI_OFFSET = '+03:00';

export function parseDateTime(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string' || !value.trim()) return null;

  const normalized = value.trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const isLocalDateTime =
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/.test(
      normalized
    );
  const localDateTime = normalized.includes('T')
    ? normalized
    : `${normalized}T00:00`;
  const dateValue =
    !hasTimezone && isLocalDateTime
      ? `${localDateTime}${NAIROBI_OFFSET}`
      : normalized;
  const parsed = new Date(dateValue);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
