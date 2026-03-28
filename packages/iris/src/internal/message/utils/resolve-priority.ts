import type { PublishOptions } from "../../../types";
import type { MessageMetadata } from "../types/metadata";

export const resolvePriority = (
  options: PublishOptions | undefined,
  metadata: MessageMetadata,
): number => {
  return options?.priority ?? metadata.priority ?? 0;
};
