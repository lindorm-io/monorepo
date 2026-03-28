import type { PublishOptions } from "../../../types";
import type { MessageMetadata } from "../types/metadata";

export const resolveDelay = (
  options: PublishOptions | undefined,
  metadata: MessageMetadata,
): number => {
  return options?.delay ?? metadata.delay ?? 0;
};
