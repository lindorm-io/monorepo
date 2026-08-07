import type { MessageMetadata } from "../types/metadata.js";
import { applyNamespace } from "./apply-namespace.js";

/**
 * The topic a message resolves to WITHOUT an instance in hand — a static
 * `@Topic`, else the message name. Equals the publish topic for every message
 * except one with a dynamic `@Topic` callback.
 */
export const resolveDefaultTopic = (metadata: MessageMetadata): string =>
  applyNamespace(
    metadata.topic?.type === "static" ? metadata.topic.topic : metadata.message.name,
    metadata.namespace,
  );
