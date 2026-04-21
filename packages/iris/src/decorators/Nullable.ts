import { stageFieldModifier } from "../internal/message/metadata/stage-metadata.js";

export const Nullable =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Nullable",
      nullable: true,
    });
  };
