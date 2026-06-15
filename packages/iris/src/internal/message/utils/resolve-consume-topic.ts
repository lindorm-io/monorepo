import type { ILogger } from "@lindorm/logger";
import type { MessageMetadata } from "../types/metadata.js";
import { resolveDefaultTopic } from "./resolve-default-topic.js";

export const resolveConsumeTopic = (
  metadata: MessageMetadata,
  logger?: ILogger,
  queue?: string,
): string => {
  if (metadata.topic?.callback) {
    // A dynamic @Topic callback resolves the publish topic from each message
    // instance, so consume() cannot derive it statically. The caller-supplied
    // queue is the only reliable source for the topic to listen on -- publishers
    // and consumers agree on this exact string by convention -- so honor it.
    // Only fall back to the namespaced message name when no queue was provided.
    if (queue) {
      return queue;
    }

    logger?.warn(
      "Message uses a dynamic @Topic callback and no explicit queue was provided; consume() cannot resolve it statically and falls back to the namespaced message name",
      { message: metadata.message.name, namespace: metadata.namespace },
    );
  }

  return resolveDefaultTopic(metadata);
};
