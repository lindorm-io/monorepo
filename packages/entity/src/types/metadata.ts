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
  | "url"
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
  decorator: string;
  cache: string | null;
  database: string | null;
  name: string;
  namespace: string | null;
};

export type MetaExtra<T extends Dict = Dict> = {
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
  keys: Array<MetaIndexItem>;
  name: string | null;
  options: MetaIndexOptions;
  unique: boolean;
};

export type MetaPrimaryKey = {
  key: string;
};

export type RelationDestroy = "cascade" | "restrict" | "ignore";
export type RelationChange = "cascade" | "ignore";
export type RelationLoading = "eager" | "lazy" | "ignore";
export type RelationOrphan = "delete" | "ignore";
export type RelationStrategy = "join" | "query";

export type MetaRelationOptions = {
  loading: RelationLoading;
  nullable: boolean;
  onDestroy: RelationDestroy;
  onInsert: RelationChange;
  onOrphan: RelationOrphan;
  onUpdate: RelationChange;
  strategy: RelationStrategy | null;
};

export type MetaRelation = {
  key: string;
  foreignConstructor: () => Constructor<IEntity>;
  foreignKey: string;
  findKeys: Dict<string> | null;
  joinKeys: Dict<string> | null;
  joinTable: string | boolean | null;
  options: MetaRelationOptions;
  type: "ManyToMany" | "ManyToOne" | "OneToMany" | "OneToOne";
};

export type MetaSource = "MnemosSource" | "MongoSource" | "RedisSource";

export type MetaPrimarySource<T extends MetaSource = MetaSource> = {
  source: T;
};

export type MetaSchema = {
  schema: ZodObject<IEntity>;
};

export type EntityMetadata<
  TExtra extends Dict = Dict,
  TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
  TSource extends MetaSource = MetaSource,
> = {
  target: Constructor<IEntity>;
  columns: Array<MetaColumn<TDecorator>>;
  entity: MetaEntity;
  extras: Array<MetaExtra<TExtra>>;
  generated: Array<MetaGenerated>;
  hooks: Array<MetaHook>;
  indexes: Array<MetaIndex>;
  primaryKeys: Array<string>;
  primarySource: TSource | null;
  relations: Array<MetaRelation>;
  schemas: Array<ZodObject<IEntity>>;
};
