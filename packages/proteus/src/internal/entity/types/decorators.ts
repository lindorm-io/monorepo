import { IndexDirection } from "../../types/types";
import { MetaFieldType, RelationStrategy } from "./metadata";

export type NamedDecoratorOptions = {
  name?: string;
};

export type EntityDecoratorOptions = NamedDecoratorOptions;

export type FieldDecoratorOptions = NamedDecoratorOptions & {
  arrayType?: MetaFieldType;
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
