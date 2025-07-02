import { isObject, isString } from "@lindorm/is";
import { FieldDecoratorOptions, MetaFieldType } from "../types";
import { globalMessageMetadata } from "../utils";

export function Field(
  type?: MetaFieldType,
  options?: Omit<FieldDecoratorOptions, "type">,
): PropertyDecorator;
export function Field(options?: FieldDecoratorOptions): PropertyDecorator;
export function Field(arg1?: any, arg2?: any): PropertyDecorator {
  return function (target, key) {
    const type = isString<MetaFieldType>(arg1)
      ? arg1
      : isObject<FieldDecoratorOptions>(arg1)
        ? arg1.type
        : null;

    const options: FieldDecoratorOptions | undefined = isObject(arg1) ? arg1 : arg2;

    globalMessageMetadata.addField({
      target: target.constructor,
      key: key.toString(),
      decorator: "Field",
      enum: options?.enum ?? null,
      fallback: options?.fallback ?? null,
      max: options?.max ?? null,
      min: options?.min ?? null,
      nullable: options?.nullable ?? false,
      optional: options?.optional ?? false,
      schema: options?.schema ?? null,
      type: type ?? null,
    });
  };
}
