import { IrisMetadataError } from "../errors/IrisMetadataError.js";
import { stageExpiry } from "../internal/message/metadata/stage-metadata.js";

export const Expiry =
  (ms: number) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    if (!Number.isInteger(ms) || ms < 0) {
      throw new IrisMetadataError("@Expiry value must be a non-negative integer");
    }
    stageExpiry(context.metadata, ms);
  };
