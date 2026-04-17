import { stageField } from "../internal/message/metadata/stage-metadata";

export const PersistentField =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "PersistentField",
      default: false,
      enum: null,
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      transform: null,
      type: "boolean",
    });
  };
