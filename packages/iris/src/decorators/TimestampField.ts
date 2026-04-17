import { stageField } from "../internal/message/metadata/stage-metadata";

export const TimestampField =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "TimestampField",
      default: () => new Date(),
      enum: null,
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      transform: null,
      type: "date",
    });
  };
