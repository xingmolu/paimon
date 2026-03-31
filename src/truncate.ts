/**
 * Utility for truncating tool output to prevent context overflow
 */

/** Maximum characters allowed in tool output */
export const MAX_TOOL_OUTPUT_CHARS = 30000;

/**
 * Truncates tool output if it exceeds the maximum character limit.
 * Adds a truncation notice when output is shortened.
 *
 * @param text - The text to potentially truncate
 * @param label - Label for the truncation notice (e.g., tool name)
 * @returns Truncated text with notice, or original text if within limits
 */
export function truncateToolOutput(text: string, label: string): string {
	if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
	const truncated = text.slice(0, MAX_TOOL_OUTPUT_CHARS);
	const remaining = text.length - MAX_TOOL_OUTPUT_CHARS;
	return `${truncated}\n\n... [${label} output truncated, ${remaining} more characters]`;
}
