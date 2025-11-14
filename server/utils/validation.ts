/**
 * Input validation utilities
 */

const MAX_CONTENT_SIZE = 1048576; // 1MB

/**
 * Validate markdown content size
 */
export function validateContentSize(content: string): boolean {
  const sizeBytes = new TextEncoder().encode(content).length;
  return sizeBytes <= MAX_CONTENT_SIZE;
}

/**
 * Validate topic ID format (base64url, 22 characters)
 */
export function validateTopicId(topicId: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(topicId);
}

/**
 * Validate emoji (single character)
 */
export function validateEmoji(emoji: string): boolean {
  // Simple validation - checks if it's a single character
  // In production, you might want more sophisticated emoji validation
  return emoji.length > 0 && emoji.length <= 10; // Allow for multi-byte emojis
}

/**
 * Get content size in bytes
 */
export function getContentSize(content: string): number {
  return new TextEncoder().encode(content).length;
}
