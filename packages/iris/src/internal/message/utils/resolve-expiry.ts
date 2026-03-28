import type { PublishOptions } from "../../../types";
import type { MessageMetadata } from "../types/metadata";

export const resolveExpiry = (
  options: PublishOptions | undefined,
  metadata: MessageMetadata,
): number | null => {
  return options?.expiry ?? metadata.expiry ?? null;
};
