import type { IMessage } from "../../../interfaces/index.js";
import type { MessageMetadata } from "../types/metadata.js";

export const resolveTopic = (message: IMessage, metadata: MessageMetadata): string => {
  const base = metadata.topic ? metadata.topic.callback(message) : metadata.message.name;
  return metadata.namespace ? `${metadata.namespace}.${base}` : base;
};
