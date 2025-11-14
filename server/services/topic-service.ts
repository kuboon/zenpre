/**
 * Topic service - Business logic for topic management
 */

import type { StorageAbstraction } from "../storage/abstraction.ts";
import type { StoredTopic, Topic, TopicPair } from "../models/topic.ts";
import { generateTopic } from "../utils/crypto.ts";
import { validateContentSize } from "../utils/validation.ts";

const TOPIC_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export class TopicService {
  constructor(private storage: StorageAbstraction<StoredTopic>) {}

  /**
   * Create a new topic
   */
  async createTopic(): Promise<TopicPair> {
    const pair = await generateTopic();

    // Initialize topic with empty content
    const now = new Date().toISOString();
    const storedTopic: StoredTopic = {
      markdown: "",
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.set(
      ["topic", pair.topicId],
      storedTopic,
      TOPIC_EXPIRATION_MS,
    );

    return pair;
  }

  /**
   * Get topic by ID
   */
  async getTopic(topicId: string): Promise<Topic | null> {
    const stored = await this.storage.get(["topic", topicId]);

    if (!stored) {
      return null;
    }

    return {
      topicId,
      markdown: stored.markdown,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
    };
  }

  /**
   * Update topic content
   */
  async updateContent(topicId: string, markdown: string): Promise<void> {
    if (!validateContentSize(markdown)) {
      throw new Error("Content exceeds size limit (1MB)");
    }

    const existing = await this.storage.get(["topic", topicId]);

    if (!existing) {
      throw new Error("Topic not found");
    }

    const updatedTopic: StoredTopic = {
      markdown,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.set(
      ["topic", topicId],
      updatedTopic,
      TOPIC_EXPIRATION_MS,
    );
  }

  /**
   * Check if topic exists
   */
  async topicExists(topicId: string): Promise<boolean> {
    return await this.storage.has(["topic", topicId]);
  }
}
