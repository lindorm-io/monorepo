/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { Constructor, Dict } from "@lindorm/types";
import { ZodObject, ZodType } from "zod";
import { IEntity } from "../interfaces";
import { IndexDirection } from "./types";

export type MetaColumnType =
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
  | "uuid";

export type MetaColumnDecorator =
  // default
  | "Column"
  // special (unique)
  | "PrimaryKeyColumn"
  | "ScopeColumn"
  | "VersionColumn"
  // date
  | "CreateDateColumn"
  | "UpdateDateColumn"
  | "ExpiryDateColumn"
  | "DeleteDateColumn"
  // versioning
  | "VersionKeyColumn"
  | "VersionStartDateColumn"
  | "VersionEndDateColumn";

export type ColumnFallbackPrimitive = bigint | boolean | Date | number | string | null;
export type ColumnFallbackComplex =
  | Array<ColumnFallbackPrimitive>
  | Dict<ColumnFallbackPrimitive>
  | ColumnFallbackPrimitive;
export type MetaColumnFallback = (() => ColumnFallbackComplex) | ColumnFallbackComplex;

export type MetaColumn<T extends MetaColumnDecorator = MetaColumnDecorator> = {
  target: Function;
  key: string;
  decorator: T;
  enum: any | null; // enum corresponds to the type "enum" property
  fallback: MetaColumnFallback | null; // when value is not set, use this fallback value or function
  max: number | null; // max size (number) or length (array, string)
  min: number | null; // min size (number) or length (array, string)
  nullable: boolean; // can the column value be null
  optional: boolean; // can the column value be undefined
  readonly: boolean; // designates as readonly for operations where updates do not occur on the entity such as updateMany(criteria, partial)
  schema: ZodType | null; // overrides the type with a zod schema
  type: MetaColumnType | null; // used to determine zod schema for validation
};

export type MetaEntity = {
  target: Function;
  decorator: string;
  cache: string | null;
  database: string | null;
  name: string | null;
  namespace: string | null;
};

export type MetaExtra<T extends Dict = Dict> = {
  target: Function;
  type: string;
} & T;

export type MetaGeneratedStrategy =
  // basic
  | "date"
  | "float"
  | "integer"
  | "string"
  | "uuid"
  // special
  | "increment";

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
  | "OnInsert"
  | "OnUpdate"
  | "OnDestroy";

export type MetaHook = {
  target: Function;
  decorator: MetaHookDecorator;
  callback: (entity: any) => void;
};

export type MetaIndexItem = {
  key: string;
  direction: IndexDirection;
};

export type MetaIndexOptions = {
  background?: boolean;
  bits?: number;
  bucketSize?: number;
  expireAfterSeconds?: number;
  hidden?: boolean;
  max?: number;
  min?: number;
  sparse?: boolean;
  version?: number;
};

export type MetaIndex = {
  target: Function;
  keys: Array<MetaIndexItem>;
  name: string | null;
  options: MetaIndexOptions;
  unique: boolean;
};

export type MetaPrimaryKey = {
  target: Function;
  key: string;
};

export type RelationChange = "cascade" | "default" | "restrict";
export type RelationLoading = "eager" | "lazy";
export type RelationOrphan = "delete" | "ignore";
export type RelationStrategy = "join" | "query";

export type MetaRelationOptions = {
  joinKey: boolean | string | null;
  joinTable: boolean | string | null;
  loading: RelationLoading | null;
  nullable: boolean;
  onDelete: RelationChange | null;
  onOrphan: RelationOrphan | null;
  onUpdate: RelationChange | null;
  strategy: RelationStrategy | null;
};

export type MetaRelation = {
  target: Function;
  key: string;
  options: MetaRelationOptions;
  foreignConstructor: () => Constructor<IEntity>;
  foreignKey: string | null;
  type: "ManyToMany" | "ManyToOne" | "OneToMany" | "OneToOne";
};

export type MetaSource =
  | "elastic"
  | "external"
  | "mnemos"
  | "mongo"
  | "postgres"
  | "redis";

export type MetaPrimarySource<T extends MetaSource = MetaSource> = {
  target: Function;
  source: T;
};

export type MetaSchema = {
  target: Function;
  schema: ZodObject<IEntity>;
};

export type EntityMetadata<
  TExtra extends Dict = Dict,
  TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
  TSource extends MetaSource = MetaSource,
> = {
  columns: Array<Omit<MetaColumn<TDecorator>, "target">>;
  entity: Omit<MetaEntity, "target">;
  extras: Array<Omit<MetaExtra<TExtra>, "target">>;
  generated: Array<Omit<MetaGenerated, "target">>;
  hooks: Array<Omit<MetaHook, "target">>;
  indexes: Array<Omit<MetaIndex, "target">>;
  primaryKeys: Array<string>;
  primarySource: TSource | null;
  relations: Array<Omit<MetaRelation, "target">>;
  schemas: Array<ZodObject<IEntity>>;
};
