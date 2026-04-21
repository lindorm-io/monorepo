import type { PublishOptions } from "../../../types/index.js";
import type { MessageMetadata } from "../types/metadata.js";

export const resolveDelay = (
  options: PublishOptions | undefined,
  metadata: MessageMetadata,
): number => {
  return options?.delay ?? metadata.delay ?? 0;
};
