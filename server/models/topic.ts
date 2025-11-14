/**
 * Topic data models and types for real-time presentation server
 */

export interface Topic {
  topicId: string;
  markdown: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicPair {
  topicId: string;
  secret: string;
}

export interface CreateTopicResponse extends TopicPair {
  subPath: string;
  pubPath: string;
}

export type AccessLevel = "readable" | "writable" | "invalid";

/**
 * Stored topic data in Deno KV
 */
export interface StoredTopic {
  markdown: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * WebSocket message types
 */
export interface ContentMessage {
  markdown: string;
}

export interface MetaMessage {
  currentPage?: number;
  currentSection?: number;
  reaction?: {
    emoji: string;
    timestamp: number;
  };
}

export interface WebSocketInbound {
  markdown?: string; // Content update (publisher only)
  currentPage?: number; // Page navigation (publisher only)
  currentSection?: number; // Section navigation (publisher only)
  pub?: {
    // Subscriber interaction
    reaction: {
      emoji: string;
      timestamp: number;
    };
  };
}

export interface WebSocketOutbound {
  markdown?: string; // Content broadcast
  currentPage?: number; // Page sync
  currentSection?: number; // Section sync
  pub?: {
    // Subscriber interaction broadcast
    reaction: {
      emoji: string;
      timestamp: number;
    };
  };
}

export interface ErrorResponse {
  error: string;
  code?: string;
  timestamp?: number;
}
