import { ZodType } from "zod";
import { IMessage } from "../interfaces";
import { MetaFieldFallback, MetaFieldType, MetaGeneratedStrategy } from "./metadata";

export type FieldDecoratorOptions = {
  enum?: any;
  fallback?: MetaFieldFallback;
  max?: number;
  min?: number;
  nullable?: boolean;
  optional?: boolean;
  schema?: ZodType;
  type?: MetaFieldType;
};

export type MessageDecoratorOptions = {
  name?: string;
  namespace?: string;
  topic?: string;
};

export type GeneratedDecoratorOptions = {
  strategy?: MetaGeneratedStrategy;
  length?: number;
  max?: number;
  min?: number;
};

export type HookDecoratorCallback<M extends IMessage> = (message: M) => void;

export type TopicDecoratorCallback<M extends IMessage = IMessage> = (
  message: M,
) => string;
