/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { Dict } from "@lindorm/types";
import { ZodObject, ZodType } from "zod";
import { IMessage } from "../interfaces";

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
  // default
  | "Field"
  // special (unique)
  | "CorrelationField"
  | "DelayField"
  | "IdentifierField"
  | "MandatoryField"
  | "PersistentField"
  | "PriorityField"
  // date
  | "TimestampField";

export type FieldFallbackPrimitive = bigint | boolean | Date | number | string | null;
export type FieldFallbackComplex =
  | Array<FieldFallbackPrimitive>
  | Dict<FieldFallbackPrimitive>
  | FieldFallbackPrimitive;
export type MetaFieldFallback = (() => FieldFallbackComplex) | FieldFallbackComplex;

export type MetaField<T extends MetaFieldDecorator = MetaFieldDecorator> = {
  target: Function;
  key: string;
  decorator: T;
  enum: any | null;
  fallback: MetaFieldFallback | null;
  max: number | null;
  min: number | null;
  nullable: boolean;
  optional: boolean;
  schema: ZodType | null;
  type: MetaFieldType | null;
};

export type MetaMessage = {
  target: Function;
  decorator: string;
  name: string | null;
  namespace: string | null;
  topic: string | null;
};

export type MetaGeneratedStrategy = "date" | "float" | "integer" | "string" | "uuid";

export type MetaGenerated = {
  target: Function;
  key: string;
  length: number | null;
  max: number | null;
  min: number | null;
  strategy: MetaGeneratedStrategy;
};

export type MetaHookDecorator =
  // before
  | "OnCreate"
  | "OnValidate"
  // after
  | "OnPublish"
  | "OnConsume";

export type MetaHook = {
  target: Function;
  decorator: MetaHookDecorator;
  callback: (message: any) => void;
};

export type MetaSchema = {
  target: Function;
  schema: ZodObject<IMessage>;
};

export type MessageMetadata<T extends MetaFieldDecorator = MetaFieldDecorator> = {
  fields: Array<Omit<MetaField<T>, "target">>;
  generated: Array<Omit<MetaGenerated, "target">>;
  hooks: Array<Omit<MetaHook, "target">>;
  message: Omit<MetaMessage, "target">;
  schemas: Array<ZodObject<IMessage>>;
};
