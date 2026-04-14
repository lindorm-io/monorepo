import type { Dict } from "@lindorm/types";
import type { z } from "zod/v4";
import type { IEntity } from "../../../interfaces";
import type { DiscriminatorValue, InheritanceStrategy } from "./inheritance";
import type {
  EmbeddedListLoadingScope,
  MetaCheck,
  MetaEntity,
  MetaExtra,
  MetaField,
  MetaFilter,
  MetaFieldDefault,
  MetaFieldType,
  MetaGenerated,
  MetaHook,
  MetaIndex,
  MetaPrimaryKey,
  MetaRelationOptions,
  MetaUnique,
  MetaVersionKey,
  QueryScope,
  RelationChange,
  RelationDestroy,
  RelationLoading,
  RelationOrphan,
} from "./metadata";

export type StagedRelation = {
  key: string;
  foreignConstructor: () => any;
  foreignKey: string;
  findKeys: Dict | Array<string> | boolean | null;
  joinKeys: Dict | Array<string> | boolean | null;
  joinTable: string | boolean | null;
  options: MetaRelationOptions;
  type: "ManyToMany" | "ManyToOne" | "OneToMany" | "OneToOne";
};

// Field modifier — partial metadata staged by modifier decorators
export type StagedFieldModifier = {
  key: string;
  decorator: string;
  nullable?: boolean;
  default?: MetaFieldDefault;
  readonly?: boolean;
  min?: number;
  max?: number;
  precision?: number;
  scale?: number;
  comment?: string;
  enum?: Record<string, string | number>;
  computed?: string;
  transform?: { to: (value: unknown) => unknown; from: (raw: unknown) => unknown };
  encrypted?: { predicate: Dict | null };
  hideOn?: Array<QueryScope>;
  schema?: z.ZodType;
};

// Relation modifier — partial metadata staged by relation modifier decorators
export type StagedRelationModifier = {
  key: string;
  decorator: string;
  loading?: RelationLoading;
  loadingScope?: QueryScope;
  cascade?: {
    onInsert?: RelationChange;
    onUpdate?: RelationChange;
    onDestroy?: RelationDestroy;
    onSoftDestroy?: RelationDestroy;
  };
  deferrable?: boolean;
  initiallyDeferred?: boolean;
  onOrphan?: RelationOrphan;
  orderBy?: Record<string, "ASC" | "DESC">;
  eager?: boolean;
  lazy?: boolean;
};

// JoinField — staged by @JoinKey decorator
export type StagedJoinField = {
  key: string;
  joinKeys: Dict<string> | true;
  referencedKey?: string;
};

// JoinTable — staged by @JoinTable decorator
export type StagedJoinTable = {
  key: string;
  name?: string;
};

// RelationId — staged by @RelationId decorator
export type StagedRelationId = {
  key: string;
  relationKey: string;
  column: string | null;
};

// RelationCount — staged by @RelationCount decorator
export type StagedRelationCount = {
  key: string;
  relationKey: string;
};

export type StagedCache = {
  ttlMs: number | null; // null = no explicit TTL, fall back to source default
};

export type StagedEmbedded = {
  key: string;
  embeddableConstructor: () => any;
  prefix: string;
};

export type StagedEmbeddedList = {
  key: string;
  elementConstructor: (() => any) | null; // for embeddable arrays
  elementType: MetaFieldType | null; // for primitive arrays
  tableName: string | null; // custom table name, null = auto
  loading?: EmbeddedListLoadingScope; // resolved from @Eager/@Lazy modifiers at build time
};

export type StagedMetadata = {
  // Field-level
  embeddedLists?: Array<StagedEmbeddedList>;
  embeddeds?: Array<StagedEmbedded>;
  fields?: Array<MetaField>;
  fieldModifiers?: Array<StagedFieldModifier>;
  generated?: Array<MetaGenerated>;
  indexes?: Array<MetaIndex>;
  primaryKeys?: Array<MetaPrimaryKey>;
  relations?: Array<StagedRelation>;
  relationModifiers?: Array<StagedRelationModifier>;
  joinFields?: Array<StagedJoinField>;
  joinTables?: Array<StagedJoinTable>;
  relationIds?: Array<StagedRelationId>;
  relationCounts?: Array<StagedRelationCount>;
  uniques?: Array<MetaUnique>;
  versionKeys?: Array<MetaVersionKey>;
  // Class-level
  __abstract?: boolean;
  __appendOnly?: boolean;
  __discriminator?: { fieldName: string };
  __discriminatorValue?: DiscriminatorValue;
  __embeddable?: boolean;
  __inheritance?: InheritanceStrategy;
  cache?: StagedCache;
  checks?: Array<MetaCheck>;
  defaultOrder?: Record<string, "ASC" | "DESC">;
  entity?: MetaEntity;
  extras?: Array<MetaExtra>;
  filters?: Array<MetaFilter>;
  hooks?: Array<MetaHook>;
  namespace?: string;
  schemas?: Array<z.ZodObject<IEntity>>;
};
