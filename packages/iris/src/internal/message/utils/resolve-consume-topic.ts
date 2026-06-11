import type { ILogger } from "@lindorm/logger";
import type { MessageMetadata } from "../types/metadata.js";
import { resolveDefaultTopic } from "./resolve-default-topic.js";

export const resolveConsumeTopic = (
  metadata: MessageMetadata,
  logger?: ILogger,
): string => {
  if (metadata.topic?.callback) {
    logger?.warn(
      "Message uses a dynamic @Topic callback; consume() cannot resolve it statically and falls back to the namespaced message name",
      { message: metadata.message.name, namespace: metadata.namespace },
    );
  }

  return resolveDefaultTopic(metadata);
};
