import { stageField } from "#internal/message/metadata/stage-metadata";
import type { MetaFieldType } from "#internal/message/types/types";
import type { FieldDecoratorOptions } from "../types/decorator-options";

export const Field =
  (type: MetaFieldType, options?: FieldDecoratorOptions) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    const opts = options ?? {};

    stageField(context.metadata, {
      key: String(context.name),
      decorator: "Field",
      default: opts.default ?? null,
      enum: null,
      max: null,
      min: null,
      nullable: opts.nullable ?? false,
      optional: opts.optional ?? false,
      schema: null,
      transform: opts.transform ?? null,
      type,
    });
  };
