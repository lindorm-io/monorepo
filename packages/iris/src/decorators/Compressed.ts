import type { IrisCompressionAlgorithm } from "../types/index.js";
import { stageCompressed } from "../internal/message/metadata/stage-metadata.js";

export const Compressed =
  (algorithm: IrisCompressionAlgorithm = "gzip") =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageCompressed(context.metadata, { algorithm });
  };
