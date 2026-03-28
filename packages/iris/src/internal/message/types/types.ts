export type MetaFieldType =
  | "array"
  | "bigint"
  | "boolean"
  | "date"
  | "email"
  | "enum"
  | "float"
  | "integer"
  | "object"
  | "string"
  | "url"
  | "uuid";

export type MetaFieldDecorator =
  | "Field"
  | "CorrelationField"
  | "IdentifierField"
  | "MandatoryField"
  | "PersistentField"
  | "TimestampField";

export type MetaHookDecorator =
  | "OnCreate"
  | "OnHydrate"
  | "OnValidate"
  | "BeforePublish"
  | "AfterPublish"
  | "BeforeConsume"
  | "AfterConsume"
  | "OnConsumeError";

export type MetaGeneratedStrategy = "uuid" | "date" | "string" | "integer" | "float";

export type FieldDefaultPrimitive = bigint | boolean | Date | number | string | null;
export type FieldDefaultComplex =
  | Array<FieldDefaultPrimitive>
  | Record<string, FieldDefaultPrimitive>
  | FieldDefaultPrimitive;
export type MetaFieldDefault = (() => FieldDefaultComplex) | FieldDefaultComplex;

export type MetaTransform = {
  to: (value: unknown) => unknown;
  from: (raw: unknown) => unknown;
};
