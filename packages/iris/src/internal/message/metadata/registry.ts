import type { MessageMetadata } from "../types/metadata";

const messageRegistry = new Map<string, Function>();
const targetToName = new Map<Function, string>();
const metadataCache = new Map<Function, MessageMetadata>();

export const registerMessage = (name: string, target: Function): void => {
  const existing = messageRegistry.get(name);
  if (existing && existing !== target) {
    // In HMR or test environments, the same message name may be re-decorated
    // with a new constructor reference. Allow re-registration by updating both maps.
    targetToName.delete(existing);
  }
  messageRegistry.set(name, target);
  targetToName.set(target, name);
};

export const findMessageByName = (name: string): Function | undefined =>
  messageRegistry.get(name);

export const findMessageByTarget = (target: Function): string | undefined =>
  targetToName.get(target);

export const getCachedMetadata = (target: Function): MessageMetadata | undefined =>
  metadataCache.get(target);

export const setCachedMetadata = (target: Function, metadata: MessageMetadata): void => {
  metadataCache.set(target, metadata);
};

/**
 * Clears only the computed metadata cache, not the raw decorator registry.
 * Called by `IrisSource._doSetup()` to force recomputation of message metadata
 * from the underlying decorator registry on the next access.
 * Safe to call from multiple sources — only causes transient recomputation, not data loss.
 */
export const clearMetadataCache = (): void => {
  metadataCache.clear();
};

export const clearRegistry = (): void => {
  messageRegistry.clear();
  targetToName.clear();
  metadataCache.clear();
};
