/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { ZodType } from "zod";
import {
  MetaColumnFallback,
  MetaColumnType,
  MetaGeneratedStrategy,
  MetaIndexOptions,
} from "./metadata";
import { IndexDirection } from "./types";

export type ColumnDecoratorOptions = {
  enum?: any;
  fallback?: MetaColumnFallback;
  max?: number;
  min?: number;
  nullable?: boolean;
  optional?: boolean;
  readonly?: boolean;
  schema?: ZodType;
  type?: MetaColumnType;
};

export type EntityDecoratorOptions = {
  cache?: string;
  database?: string;
  name?: string;
  namespace?: string;
};

export type GeneratedDecoratorOptions = {
  strategy?: MetaGeneratedStrategy;
  length?: number;
  max?: number;
  min?: number;
};

export type HookDecoratorCallback = (entity: any) => void;

export type IndexDecoratorOptions = {
  direction?: IndexDirection;
  name?: string;
  options?: MetaIndexOptions;
  unique?: boolean;
};

export type UniqueDecoratorOptions = {
  name?: string;
};
