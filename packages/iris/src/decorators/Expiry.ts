import { IrisMetadataError } from "../errors/IrisMetadataError.js";
import { stageExpiry } from "../internal/message/metadata/stage-metadata.js";

export const Expiry =
  (ms: number) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    if (!Number.isInteger(ms) || ms < 0) {
      throw new IrisMetadataError("@Expiry value must be a non-negative integer", {
        code: "invalid_expiry",
        title: "Invalid Expiry",
        details:
          "The @Expiry decorator requires a non-negative integer number of milliseconds.",
      });
    }
    stageExpiry(context.metadata, ms);
  };
