import {
  stageField,
  stageGenerated,
} from "../internal/message/metadata/stage-metadata.js";

export const TimestampField =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    const key = String(context.name);

    stageField(context.metadata, {
      key,
      decorator: "TimestampField",
      default: null,
      enum: null,
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      transform: null,
      type: "date",
    });

    stageGenerated(context.metadata, {
      key,
      generator: null,
      strategy: "date",
      length: null,
      max: null,
      min: null,
      namespace: null,
    });
  };
