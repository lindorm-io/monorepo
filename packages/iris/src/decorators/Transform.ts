import type { MetaTransform } from "../internal/message/types/types.js";
import { stageTransform } from "../internal/message/metadata/stage-metadata.js";

export const Transform =
  (options: MetaTransform) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageTransform(context.metadata, {
      key: String(context.name),
      transform: options,
    });
  };
