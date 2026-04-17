import { IrisMetadataError } from "../errors/IrisMetadataError";
import { stageVersion } from "../internal/message/metadata/stage-metadata";

export const Version =
  (version: number) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    if (!Number.isInteger(version) || version < 1) {
      throw new IrisMetadataError("@Version value must be a positive integer");
    }

    stageVersion(context.metadata, version);
  };
