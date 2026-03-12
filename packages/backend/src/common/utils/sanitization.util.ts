/**
 * Sanitization utilities to prevent XSS and SQL injection
 */

/**
 * Basic XSS sanitization by escaping HTML special characters
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Basic SQL escaping (simplified)
 */
export function escapeSql(input: string): string {
  if (typeof input !== 'string') return input;
  
  return input.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case "\0": return "\\0";
      case "\x08": return "\\b";
      case "\x09": return "\\t";
      case "\x1a": return "\\z";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\"":
      case "'":
      case "\\":
      case "%":
        return "\\" + char;
      default:
        return char;
    }
  });
}

/**
 * Sanitize all string properties in an object
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  
  const result = { ...obj } as any;
  
  for (const key in result) {
    if (typeof result[key] === 'string') {
      result[key] = sanitizeHtml(result[key]);
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = sanitizeObject(result[key]);
    }
  }
  
  return result;
}
