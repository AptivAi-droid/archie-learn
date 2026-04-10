/**
 * Strip HTML tags and truncate to maxLength.
 * Use on all free-text user input before sending to AI or storing.
 */
export function sanitizeInput(value, maxLength = 4000) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<[^>]*>/g, '')   // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .trim()
    .slice(0, maxLength)
}
