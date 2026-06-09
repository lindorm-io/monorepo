import { IrisMetadataError } from "../errors/IrisMetadataError.js";
import { stageVersion } from "../internal/message/metadata/stage-metadata.js";

export const Version =
  (version: number) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    if (!Number.isInteger(version) || version < 1) {
      throw new IrisMetadataError("@Version value must be a positive integer", {
        code: "invalid_version",
        title: "Invalid Version",
        details: "The @Version decorator requires a positive integer of 1 or greater.",
      });
    }

    stageVersion(context.metadata, version);
  };
