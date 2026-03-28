import type { MessageMetadata } from "../types/metadata";

export const resolveDefaultTopic = (metadata: MessageMetadata): string => {
  const base = metadata.message.name;
  return metadata.namespace ? `${metadata.namespace}.${base}` : base;
};
