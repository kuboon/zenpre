/**
 * Cryptography utilities for HMAC authentication and token generation
 */

import { encodeBase64Url } from "@std/encoding/base64url";
import { decodeBase64Url } from "@std/encoding/base64url";
import type { AccessLevel, TopicPair } from "../models/topic.ts";

// Cache for HMAC key
let cachedKey: CryptoKey | null = null;

/**
 * Get or generate HMAC key from environment
 */
async function getHmacKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return cachedKey;
  }

  const hmacKeyEnv = Deno.env.get("HMAC_KEY");
  let keyData: Uint8Array;

  if (hmacKeyEnv) {
    // Use key from environment
    try {
      keyData = decodeBase64Url(hmacKeyEnv);
    } catch {
      console.warn("Invalid HMAC_KEY in environment, generating new key");
      keyData = crypto.getRandomValues(new Uint8Array(32));
    }
  } else {
    // Generate random key (for development)
    console.warn(
      "HMAC_KEY not set in environment, using random key (not suitable for production)",
    );
    keyData = crypto.getRandomValues(new Uint8Array(32));
  }

  cachedKey = await crypto.subtle.importKey(
    "raw",
    keyData.buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  return cachedKey;
}

/**
 * Encode bytes to base64url string
 */
function encodeBytes(bytes: Uint8Array | ArrayBuffer): string {
  if (bytes instanceof Uint8Array) {
    return encodeBase64Url(bytes);
  }
  return encodeBase64Url(new Uint8Array(bytes));
}

/**
 * Decode base64url string to bytes
 */
function decodeToBytes(str: string): Uint8Array {
  return decodeBase64Url(str);
}

/**
 * Generate a new topic with ID and secret
 */
export async function generateTopic(): Promise<TopicPair> {
  const topicIdRaw = crypto.getRandomValues(new Uint8Array(16));
  const key = await getHmacKey();
  const secretRaw = await crypto.subtle.sign("HMAC", key, topicIdRaw);

  return {
    topicId: encodeBytes(topicIdRaw),
    secret: encodeBytes(secretRaw),
  };
}

/**
 * Verify access level based on topic ID and secret
 */
export async function verifyAccess(pair: TopicPair): Promise<AccessLevel> {
  // No secret provided = readable access
  if (!pair.secret) {
    return "readable";
  }

  try {
    const topicIdRaw = decodeToBytes(pair.topicId);
    const secretRaw = decodeToBytes(pair.secret);
    const key = await getHmacKey();

    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      secretRaw.buffer,
      topicIdRaw.buffer,
    );

    return verified ? "writable" : "invalid";
  } catch (error) {
    console.error("Access verification error:", error);
    return "invalid";
  }
}
