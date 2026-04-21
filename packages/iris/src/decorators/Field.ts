import { stageField } from "../internal/message/metadata/stage-metadata.js";
import type { MetaFieldType } from "../internal/message/types/types.js";

export const Field =
  (type: MetaFieldType) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "Field",
      default: null,
      enum: null,
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      transform: null,
      type,
    });
  };
