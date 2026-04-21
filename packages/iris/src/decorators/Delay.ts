import { IrisMetadataError } from "../errors/IrisMetadataError.js";
import { stageDelay } from "../internal/message/metadata/stage-metadata.js";

export const Delay =
  (ms: number) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    if (!Number.isInteger(ms) || ms < 0) {
      throw new IrisMetadataError("@Delay value must be a non-negative integer");
    }
    stageDelay(context.metadata, ms);
  };
