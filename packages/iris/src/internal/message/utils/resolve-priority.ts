import type { PublishOptions } from "../../../types/index.js";
import type { MessageMetadata } from "../types/metadata.js";

export const resolvePriority = (
  options: PublishOptions | undefined,
  metadata: MessageMetadata,
): number => {
  return options?.priority ?? metadata.priority ?? 0;
};
