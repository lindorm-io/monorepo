import type { MessageMetadata } from "../types/metadata";
import { buildMessageMetadata } from "./build-message-metadata";
import { getCachedMetadata, setCachedMetadata } from "./registry";

export const getMessageMetadata = (target: Function): MessageMetadata => {
  const cached = getCachedMetadata(target);
  if (cached) return cached;

  const metadata = buildMessageMetadata(target);
  setCachedMetadata(target, metadata);

  return metadata;
};
