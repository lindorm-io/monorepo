import type {
  EntityMetadata,
  MetaField,
  MetaGenerated,
  MetaIndex,
  RelationChange,
  RelationDestroy,
} from "../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../types/types.js";
import type { DesiredEnumModel, DesiredTriggerModel } from "./desired-schema-model.js";

export type ProjectedColumnType = {
  type: string;
  /** Inline enum values carried on the column (mysql); null elsewhere. */
  enumValues: Array<string> | null;
  /** Inline enum CHECK expression (sqlite); null elsewhere. */
  checkExpr: string | null;
};

export type ProjectedColumnBehavior = {
  defaultExpr: string | null;
  identity: "identity" | "auto_increment" | null;
  generatedExpr: string | null;
};

/**
 * Per-driver strategy consumed by `projectDesiredSchemaModel`. Every member
 * preserves that driver's exact historical behaviour (types, spellings, error
 * classes/messages) — several flags deliberately encode known cross-driver
 * drift that must NOT be unified as refactor fallout (see the drift notes on
 * each member).
 */
export type SyncDialect = {
  /** Max column-name length (pg 63, mysql 64, sqlite 128). */
  identifierLimit: number;
  /** False for sqlite: FKs are unnamed inline clauses, model name stays null. */
  namedForeignKeys: boolean;
  /** Drift: sqlite ignores relation.options.nullable — FK columns always NOT NULL. */
  fkColumnNullableFromRelation: boolean;
  /** Drift: pg collection tables have no PK; mysql/sqlite use (parentFk, __ordinal). */
  collectionTableHasPrimaryKey: boolean;
  /** Pg only: (namespace, name) table dedupe + namespaces output. */
  supportsNamespaces: boolean;
  /** Companion column type for typedJson fields. */
  typedJsonColumnType: string;
  /** Collection-table `__ordinal` column type. */
  ordinalColumnType: string;

  quoteIdentifier: (name: string) => string;

  /** Driver's exact identifier-limit error (class, message, details, data). */
  identifierLimitError: (column: string, entity: string) => Error;

  /** Driver's exact embedded-field/FK column collision error. */
  embeddedFkCollisionError: (
    column: string,
    entity: string,
    embeddedField: MetaField,
  ) => Error;

  /**
   * Column type for a declared field, including the driver's encrypted and
   * enum handling (named enum type refs for pg, inline enum(...) for mysql,
   * TEXT + CHECK for sqlite). Spellings are snapshot-locked.
   */
  projectColumnType: (
    field: MetaField,
    tableName: string,
    namespace: string | null,
  ) => ProjectedColumnType;

  /**
   * Collection-table parent-FK column type: the raw type mapper applied to the
   * parent PK field (no encrypted/enum handling), or the driver's fallback
   * ("UUID" / "varchar(255)" / "TEXT") when the PK field is missing.
   */
  collectionParentFkColumnType: (
    pkField: MetaField | undefined,
    tableName: string,
    namespace: string | null,
  ) => string;

  /**
   * FK column type from the referenced entity's PK. Drift: pg resolves via the
   * naming-aware resolved metadata; mysql/sqlite re-read RAW metadata from the
   * constructor (mysql additionally lowercases).
   */
  resolveFkColumnType: (
    foreignMeta: EntityMetadata,
    foreignPkKey: string,
    namespaceOptions: NamespaceOptions,
  ) => string;

  /**
   * Default / identity / generated-expression projection. Drift: pg maps
   * increment|identity → identity and uuid → gen_random_uuid(); mysql/sqlite
   * map ONLY increment (`@Generated("identity")` is ignored) and spell boolean
   * defaults 1/0 instead of true/false.
   */
  projectColumnBehavior: (
    field: MetaField,
    gen: MetaGenerated | undefined,
  ) => ProjectedColumnBehavior;

  /** Named enum type for an enum field (pg); null for inline-enum dialects. */
  namedEnumType: (
    field: MetaField,
    tableName: string,
    namespace: string | null,
  ) => DesiredEnumModel | null;

  /** ON DELETE action — mysql throws its exact error on set_default. */
  mapOnDeleteAction: (onDestroy: RelationDestroy) => string;

  /** ON UPDATE action — mysql throws its exact error on set_default. */
  mapOnUpdateAction: (onUpdate: RelationChange) => string;

  /** Index/unique column prefix length (mysql TEXT/BLOB → 191); null elsewhere. */
  indexColumnPrefixLength: (field: MetaField | undefined) => number | null;

  /** Required extensions (pg: vector, pg_trgm); empty elsewhere. */
  collectExtensions: (
    fields: Array<MetaField>,
    indexes: Array<MetaIndex>,
  ) => Array<string>;

  /** Append-only trigger DDL grouped per trigger name. */
  projectAppendOnlyTriggers: (
    tableName: string,
    namespace: string | null,
  ) => Array<DesiredTriggerModel>;
};
