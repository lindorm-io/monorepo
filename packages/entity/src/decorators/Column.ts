import { isObject, isString } from "@lindorm/is";
import { ColumnDecoratorOptions, MetaColumnType } from "../types";
import { globalEntityMetadata } from "../utils";

export function Column(
  type?: MetaColumnType,
  options?: Omit<ColumnDecoratorOptions, "type">,
): PropertyDecorator;
export function Column(options?: ColumnDecoratorOptions): PropertyDecorator;
export function Column(arg1?: any, arg2?: any): PropertyDecorator {
  return function (target, key) {
    const type = isString<MetaColumnType>(arg1)
      ? arg1
      : isObject<ColumnDecoratorOptions>(arg1)
        ? arg1.type
        : null;

    const options: ColumnDecoratorOptions | undefined = isObject(arg1) ? arg1 : arg2;

    globalEntityMetadata.addColumn({
      target: target.constructor,
      key: key.toString(),
      decorator: "Column",
      enum: options?.enum ?? null,
      fallback: options?.fallback ?? null,
      max: options?.max ?? null,
      min: options?.min ?? null,
      nullable: options?.nullable ?? false,
      optional: options?.optional ?? false,
      readonly: options?.readonly ?? false,
      schema: options?.schema ?? null,
      type: type ?? null,
    });
  };
}
