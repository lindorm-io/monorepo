import type { PublishOptions } from "../../../types/index.js";
import type { MessageMetadata } from "../types/metadata.js";

export const resolveExpiry = (
  options: PublishOptions | undefined,
  metadata: MessageMetadata,
): number | null => {
  return options?.expiry ?? metadata.expiry ?? null;
};
