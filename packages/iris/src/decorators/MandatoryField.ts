import { stageField } from "../internal/message/metadata/stage-metadata.js";

export const MandatoryField =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "MandatoryField",
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
