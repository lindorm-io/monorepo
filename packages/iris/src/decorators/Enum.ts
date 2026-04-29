import { stageFieldModifier } from "../internal/message/metadata/stage-metadata.js";

export const Enum =
  (values: Record<string, string | number>) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Enum",
      enum: values,
    });
  };
