import { stageFieldModifier } from "../internal/message/metadata/stage-metadata";

export const Optional =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Optional",
      optional: true,
    });
  };
