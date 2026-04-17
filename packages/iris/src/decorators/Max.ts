import { stageFieldModifier } from "../internal/message/metadata/stage-metadata";

export const Max =
  (value: number) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Max",
      max: value,
    });
  };
