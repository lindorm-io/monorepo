import { ZodType } from "zod";
import { IEntity } from "../interfaces";
import {
  MetaColumnFallback,
  MetaColumnType,
  MetaGeneratedStrategy,
  MetaIndexOptions,
  RelationChange,
  RelationDestroy,
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

export type ManyToManyOptions<T extends IEntity> = {
  hasJoinTable?: boolean;
  joinKeys?: Array<keyof T>;
  joinTable?: string;
  loading?: RelationLoading;
  onDestroy?: RelationDestroy;
  onInsert?: RelationChange;
  onOrphan?: RelationOrphan;
  onUpdate?: RelationChange;
  strategy?: RelationStrategy;
};

export type ManyToOneOptions<T extends IEntity, F extends IEntity> = {
  joinKeys?: { [K in keyof T]?: keyof F };
  loading?: RelationLoading;
  nullable?: boolean;
  onDestroy?: RelationDestroy;
  onInsert?: RelationChange;
  onOrphan?: RelationOrphan;
  onUpdate?: RelationChange;
  strategy?: RelationStrategy;
};

export type OneToManyOptions = {
  loading?: RelationLoading;
  onDestroy?: RelationDestroy;
  onInsert?: RelationChange;
  onOrphan?: RelationOrphan;
  onUpdate?: RelationChange;
  strategy?: RelationStrategy;
};

export type OneToOneOptions<T extends IEntity, F extends IEntity> = {
  hasJoinKey?: boolean;
  joinKeys?: { [K in keyof T]?: keyof F };
  loading?: RelationLoading;
  nullable?: boolean;
  onDestroy?: RelationDestroy;
  onInsert?: RelationChange;
  onOrphan?: RelationOrphan;
  onUpdate?: RelationChange;
  strategy?: RelationStrategy;
};

export type UniqueDecoratorOptions = {
  name?: string;
};
