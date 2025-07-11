/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { Dict } from "@lindorm/types";
import { ZodObject, ZodType } from "zod";
import { IMessage } from "../interfaces";
import { HookDecoratorCallback, TopicDecoratorCallback } from "./decorators";

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

export type MetaField<D extends MetaFieldDecorator = MetaFieldDecorator> = {
  target: Function;
  key: string;
  decorator: D;
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
  name: string;
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

export type MetaHook<M extends IMessage = IMessage> = {
  target: Function;
  decorator: MetaHookDecorator;
  callback: HookDecoratorCallback<M>;
};

export type MetaPriority = {
  target: Function;
  priority: number;
};

export type MetaSchema<M extends IMessage = IMessage> = {
  target: Function;
  schema: ZodObject<M>;
};

export type MetaTopic<M extends IMessage = IMessage> = {
  target: Function;
  callback: TopicDecoratorCallback<M>;
};

export type MessageMetadata<
  M extends IMessage = IMessage,
  T extends MetaFieldDecorator = MetaFieldDecorator,
> = {
  fields: Array<Omit<MetaField<T>, "target">>;
  generated: Array<Omit<MetaGenerated, "target">>;
  hooks: Array<Omit<MetaHook<M>, "target">>;
  message: MetaMessage;
  priority: number | null;
  schema: ZodObject<M>;
  topic: Omit<MetaTopic<M>, "target"> | null;
};
