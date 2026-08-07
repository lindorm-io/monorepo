import type { IMessage } from "../../../interfaces/index.js";
import type { MessageMetadata } from "../types/metadata.js";
import { applyNamespace } from "./apply-namespace.js";
import { resolveDefaultTopic } from "./resolve-default-topic.js";

export const resolveTopic = (message: IMessage, metadata: MessageMetadata): string =>
  metadata.topic?.type === "dynamic"
    ? applyNamespace(metadata.topic.callback(message), metadata.namespace)
    : resolveDefaultTopic(metadata);
