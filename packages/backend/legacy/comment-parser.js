export class CommentParser {
  constructor() {
    // Regex for structured comment formats
    // Format: [File: path/to/file.js] [Line: 123] [Type: security] [Severity: high] Message...
    this.structuredRegex = /\[File:\s*([^\]]+)\]\s*\[Line:\s*(\d+)\]\s*\[Type:\s*([^\]]+)\]\s*\[Severity:\s*([^\]]+)\]\s*([\s\S]+?)(?=\[File:|$)/gi;
    
    // Regex for suggested fixes in markdown blocks
    // Format: ```suggestion ... ``` or specific fix markers
    this.fixRegex = /```(?:suggestion|fix)\s*([\s\S]+?)```/gi;
  }

  parse(output) {
    const comments = [];
    let match;

    // Reset regex state
    this.structuredRegex.lastIndex = 0;

    while ((match = this.structuredRegex.exec(output)) !== null) {
      const filePath = match[1].trim();
      const lineNumber = parseInt(match[2], 10);
      const issueType = match[3].trim().toLowerCase();
      const severity = match[4].trim().toLowerCase();
      const fullMessage = match[5].trim();

      // Extract suggested fix if present in the message
      const fixMatch = new RegExp(this.fixRegex).exec(fullMessage);
      const suggestedFix = fixMatch ? fixMatch[1].trim() : null;
      const message = suggestedFix ? fullMessage.replace(this.fixRegex, '').trim() : fullMessage;

      comments.push({
        file_path: filePath,
        line_number: lineNumber,
        issue_type: issueType,
        severity: this.normalizeSeverity(severity),
        message: message,
        suggested_fix: suggestedFix,
        is_auto_fixable: !!suggestedFix
      });
    }

    // Fallback for less structured formats if needed
    if (comments.length === 0) {
      this.parseUnstructured(output, comments);
    }

    return comments;
  }

  normalizeSeverity(severity) {
    const s = severity.toLowerCase();
    if (s.includes('critical') || s.includes('error')) return 'error';
    if (s.includes('high') || s.includes('warn')) return 'warning';
    return 'info';
  }

  parseUnstructured(output, comments) {
    // Basic markdown list parsing: 1. path/to/file.js:123 - message
    const lineRegex = /(?:\d+\.\s+)?([^:\s\n]+):(\d+)\s*-\s*([^\n]+)/gi;
    let match;
    while ((match = lineRegex.exec(output)) !== null) {
      comments.push({
        file_path: match[1],
        line_number: parseInt(match[2], 10),
        issue_type: 'general',
        severity: 'warning',
        message: match[3].trim(),
        suggested_fix: null,
        is_auto_fixable: false
      });
    }
  }
}

export const commentParser = new CommentParser();
export default commentParser;
