/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { ZodType } from "zod";
import { IEntity } from "../interfaces";
import {
  MetaColumnFallback,
  MetaColumnType,
  MetaGeneratedStrategy,
  MetaIndexOptions,
  RelationChange,
  RelationLoading,
  RelationOrphan,
  RelationStrategy,
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

export type ManyToManyOptions<E extends IEntity> = {
  joinKey?: keyof E;
  joinTable?: boolean | string;
  loading?: RelationLoading;
  onDelete?: RelationChange;
  onOrphan?: RelationOrphan;
  onUpdate?: RelationChange;
  strategy?: RelationStrategy;
};

export type ManyToOneOptions<E extends IEntity> = {
  joinKey?: keyof E;
  loading?: RelationLoading;
  onDelete?: RelationChange;
  onOrphan?: RelationOrphan;
  onUpdate?: RelationChange;
  strategy?: RelationStrategy;
};

export type OneToManyOptions = {
  loading?: RelationLoading;
  onDelete?: RelationChange;
  onOrphan?: RelationOrphan;
  onUpdate?: RelationChange;
  strategy?: RelationStrategy;
};

export type OneToOneOptions<E extends IEntity> = {
  joinKey?: boolean | keyof E;
  loading?: RelationLoading;
  nullable?: boolean;
  onDelete?: RelationChange;
  onOrphan?: RelationOrphan;
  onUpdate?: RelationChange;
  strategy?: RelationStrategy;
};

export type UniqueDecoratorOptions = {
  name?: string;
};
