import type { IrisCompressionAlgorithm } from "../types";
import { stageCompressed } from "../internal/message/metadata/stage-metadata";

export const Compressed =
  (algorithm: IrisCompressionAlgorithm = "gzip") =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageCompressed(context.metadata, { algorithm });
  };
