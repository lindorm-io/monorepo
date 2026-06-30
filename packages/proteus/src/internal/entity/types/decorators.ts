import type { IndexDirection } from "../../types/types.js";
import type { MetaFieldMode, MetaFieldType, RelationStrategy } from "./metadata.js";

export type NamedDecoratorOptions = {
  name?: string;
};

export type EntityDecoratorOptions = NamedDecoratorOptions;

export type FieldDecoratorOptions = NamedDecoratorOptions & {
  arrayType?: MetaFieldType;
  // JS-representation override. Currently only `decimal` honours `mode: "string"`
  // (exact, arbitrary-precision string instead of the default `number`).
  mode?: MetaFieldMode;
};

export type UniqueDecoratorOptions = NamedDecoratorOptions;

export type CheckDecoratorOptions = NamedDecoratorOptions;

export type GeneratedDecoratorOptions = {
  length?: number;
  max?: number;
  min?: number;
};

export type IndexDecoratorOptions = NamedDecoratorOptions & {
  concurrent?: boolean;
  direction?: IndexDirection;
  sparse?: boolean;
  unique?: boolean;
  using?: string;
  where?: string;
  with?: string;
};

// Relations

export type RelationOptions = {
  strategy?: RelationStrategy;
};
