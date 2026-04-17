import { IrisMetadataError } from "../errors/IrisMetadataError";
import { stageDelay } from "../internal/message/metadata/stage-metadata";

export const Delay =
  (ms: number) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    if (!Number.isInteger(ms) || ms < 0) {
      throw new IrisMetadataError("@Delay value must be a non-negative integer");
    }
    stageDelay(context.metadata, ms);
  };
