import type { Constructor, Dict, Predicate } from "@lindorm/types";
import { z } from "zod";
import type { IEntity } from "../../../interfaces/index.js";
import type { IndexDirection } from "../../types/types.js";
import type { MetaInheritance } from "./inheritance.js";

export type MetaFieldType =
  // boolean
  | "boolean"
  // numeric (integer)
  | "bigint"
  | "integer"
  | "smallint"
  // numeric (floating point)
  | "decimal"
  | "float"
  | "real"
  // string
  | "enum"
  | "string"
  | "text"
  | "varchar"
  | "uuid"
  // date/time
  | "date"
  | "interval"
  | "time"
  | "timestamp"
  // binary
  | "binary"
  // structured
  | "array"
  | "json"
  | "object"
  // network
  | "cidr"
  | "inet"
  | "macaddr"
  // geometric
  | "box"
  | "circle"
  | "line"
  | "lseg"
  | "path"
  | "point"
  | "polygon"
  | "vector"
  // xml
  | "xml"
  // logical (convenience — stored as string, adds validation)
  | "email"
  | "url";

export type MetaFieldPrimaryType = "integer" | "string" | "uuid";

export type MetaFieldDecorator =
  // default
  | "Field"
  // special
  | "Scope"
  | "Version"
  // date
  | "CreateDate"
  | "UpdateDate"
  | "ExpiryDate"
  | "DeleteDate"
  // versioning
  | "VersionStartDate"
  | "VersionEndDate";

export type FieldDefaultPrimitive = bigint | boolean | Date | number | string | null;
export type FieldDefaultComplex =
  | Array<FieldDefaultPrimitive>
  | Dict<FieldDefaultPrimitive>
  | FieldDefaultPrimitive;
export type MetaFieldDefault = (() => FieldDefaultComplex) | FieldDefaultComplex;

export type MetaTransform = {
  to: (value: unknown) => unknown;
  from: (raw: unknown) => unknown;
};

export type MetaEncrypted = {
  predicate: Dict | null;
};

export type QueryScope = "single" | "multiple";

export type MetaFieldEmbedded = {
  parentKey: string;
  constructor: () => Constructor;
};

export type MetaField<T extends MetaFieldDecorator = MetaFieldDecorator> = {
  key: string;
  decorator: T;
  arrayType: MetaFieldType | null;
  collation: string | null;
  comment: string | null;
  computed: string | null;
  embedded: MetaFieldEmbedded | null;
  encrypted: MetaEncrypted | null;
  enum: Record<string, string | number> | null;
  default: MetaFieldDefault | null;
  hideOn: Array<QueryScope>;
  max: number | null;
  min: number | null;
  name: string;
  nullable: boolean;
  order: number | null;
  precision: number | null;
  readonly: boolean;
  scale: number | null;
  schema: z.ZodType | null;
  transform: MetaTransform | null;
  type: MetaFieldType | null;
};

export type MetaEntity = {
  decorator: string;
  comment: string | null;
  name: string;
  namespace: string | null;
};

export type MetaExtra<T extends Dict = Dict> = {
  type: string;
} & T;

export type MetaGeneratedStrategy =
  | "date"
  | "float"
  | "identity"
  | "integer"
  | "string"
  | "uuid"
  | "increment";

export type MetaGenerated = {
  key: string;
  length: number | null;
  max: number | null;
  min: number | null;
  strategy: MetaGeneratedStrategy;
};

export type MetaHookDecorator =
  // sync (in-memory)
  | "OnCreate"
  | "OnHydrate"
  | "OnValidate"
  // before (async, pre-DB-write)
  | "BeforeDestroy"
  | "BeforeInsert"
  | "BeforeRestore"
  | "BeforeSave"
  | "BeforeSoftDestroy"
  | "BeforeUpdate"
  // after (async, post-DB-write)
  | "AfterDestroy"
  | "AfterInsert"
  | "AfterLoad"
  | "AfterRestore"
  | "AfterSave"
  | "AfterSoftDestroy"
  | "AfterUpdate";

export type MetaHook = {
  decorator: MetaHookDecorator;
  callback: (entity: any, context: any) => void | Promise<void>;
};

export type MetaIndexItem = {
  key: string;
  direction: IndexDirection;
  nulls: "first" | "last" | null;
};

export type MetaIndex = {
  keys: Array<MetaIndexItem>;
  include: Array<string> | null;
  name: string | null;
  unique: boolean;
  concurrent: boolean;
  sparse: boolean;
  where: string | null;
  using: string | null;
  with: string | null;
};

export type MetaPrimaryKey = {
  key: string;
};

export type MetaVersionKey = {
  key: string;
};

export type MetaUnique = {
  keys: Array<string>;
  name: string | null;
};

export type MetaCheck = {
  expression: string;
  name: string | null;
};

export type RelationDestroy =
  | "cascade"
  | "restrict"
  | "set_null"
  | "set_default"
  | "ignore";
export type RelationChange =
  | "cascade"
  | "restrict"
  | "set_null"
  | "set_default"
  | "ignore";
export type RelationLoading = "eager" | "lazy" | "ignore";

export type RelationLoadingScope = {
  single: RelationLoading;
  multiple: RelationLoading;
};

/**
 * Orphan strategies: "delete" removes orphaned children, "nullify" sets FK to NULL,
 * "ignore" takes no action. For ManyToMany, "nullify" behaves as "delete" (removes join rows).
 */
export type RelationOrphan = "delete" | "nullify" | "ignore";
export type RelationStrategy = "join" | "query";

export type MetaRelationOptions = {
  deferrable: boolean;
  initiallyDeferred: boolean;
  loading: RelationLoadingScope;
  nullable: boolean;
  onDestroy: RelationDestroy;
  onInsert: RelationChange;
  onOrphan: RelationOrphan;
  onSoftDestroy: RelationDestroy;
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
  orderBy: Record<string, "ASC" | "DESC"> | null;
  type: "ManyToMany" | "ManyToOne" | "OneToMany" | "OneToOne";
};

export type MetaDriver = "memory" | "mongo" | "mysql" | "postgres" | "redis" | "sqlite";

export type MetaSchema = {
  schema: z.ZodObject<IEntity>;
};

export type MetaRelationId = {
  key: string;
  relationKey: string;
  column: string | null;
};

export type MetaRelationCount = {
  key: string;
  relationKey: string;
};

export type EmbeddedListLoading = "eager" | "lazy";

export type EmbeddedListLoadingScope = {
  single: EmbeddedListLoading;
  multiple: EmbeddedListLoading;
};

export type MetaEmbeddedList = {
  key: string; // property name on parent entity
  tableName: string; // resolved table name
  parentFkColumn: string; // FK column pointing to parent PK
  parentPkColumn: string; // parent's PK property key (used for entity[parentPkColumn] lookups)
  elementType: MetaFieldType | null; // for primitives
  elementFields: Array<MetaField> | null; // for embeddables (flattened fields)
  elementConstructor: (() => Constructor) | null; // for embeddable instantiation
  loading: EmbeddedListLoadingScope; // JPA-aligned default: { single: "eager", multiple: "lazy" }
};

export type MetaFilter = {
  name: string;
  condition: Predicate<Dict>;
  default: boolean;
};

export type MetaCache = {
  ttlMs: number | null;
};

export type EntityMetadata<
  TExtra extends Dict = Dict,
  TDecorator extends MetaFieldDecorator = MetaFieldDecorator,
> = {
  target: Constructor<IEntity>;
  appendOnly: boolean;
  cache: MetaCache | null; // null = no @Cache decorator
  checks: Array<MetaCheck>;
  defaultOrder: Record<string, "ASC" | "DESC"> | null;
  embeddedLists: Array<MetaEmbeddedList>;
  entity: MetaEntity;
  extras: Array<MetaExtra<TExtra>>;
  fields: Array<MetaField<TDecorator>>;
  filters: Array<MetaFilter>;
  generated: Array<MetaGenerated>;
  hooks: Array<MetaHook>;
  inheritance: MetaInheritance | null;
  indexes: Array<MetaIndex>;
  primaryKeys: Array<string>;
  relationIds: Array<MetaRelationId>;
  relationCounts: Array<MetaRelationCount>;
  relations: Array<MetaRelation>;
  schemas: Array<z.ZodObject<IEntity>>;
  scopeKeys: Array<string>;
  uniques: Array<MetaUnique>;
  versionKeys: Array<string>;
};
