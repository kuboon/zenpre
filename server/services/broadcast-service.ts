/**
 * BroadcastChannel service for message distribution across WebSocket connections
 */

import type { WebSocketOutbound } from "../models/topic.ts";

const channels = new Map<string, BroadcastChannel>();

/**
 * Get or create a BroadcastChannel for a topic
 */
export function getChannel(topicId: string): BroadcastChannel {
  let channel = channels.get(topicId);

  if (!channel) {
    channel = new BroadcastChannel(`topic:${topicId}`);
    channels.set(topicId, channel);
  }

  return channel;
}

/**
 * Broadcast message to all connections for a topic
 */
export function broadcast(topicId: string, message: WebSocketOutbound): void {
  const channel = getChannel(topicId);
  channel.postMessage(message);
}

/**
 * Close and remove channel for a topic
 */
export function closeChannel(topicId: string): void {
  const channel = channels.get(topicId);
  if (channel) {
    channel.close();
    channels.delete(topicId);
  }
}

/**
 * Subscribe to messages for a topic
 */
export function subscribe(
  topicId: string,
  handler: (message: WebSocketOutbound) => void,
): () => void {
  const channel = getChannel(topicId);

  const listener = (event: MessageEvent) => {
    handler(event.data as WebSocketOutbound);
  };

  channel.addEventListener("message", listener);

  // Return unsubscribe function
  return () => {
    channel.removeEventListener("message", listener);
  };
}
