import { stageFieldModifier } from "../internal/message/metadata/stage-metadata";

export const Min =
  (value: number) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Min",
      min: value,
    });
  };
