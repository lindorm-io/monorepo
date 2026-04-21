import type { MetaFieldDefault } from "../internal/message/types/types.js";
import { stageFieldModifier } from "../internal/message/metadata/stage-metadata.js";

export const Default =
  (value: MetaFieldDefault) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Default",
      default: value,
    });
  };
