import type { MessageMetadata } from "../types/metadata.js";
import { buildMessageMetadata } from "./build-message-metadata.js";
import { getCachedMetadata, setCachedMetadata } from "./registry.js";

export const getMessageMetadata = (target: Function): MessageMetadata => {
  const cached = getCachedMetadata(target);
  if (cached) return cached;

  const metadata = buildMessageMetadata(target);
  setCachedMetadata(target, metadata);

  return metadata;
};
