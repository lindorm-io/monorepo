/**
 * Dialect-neutral, value-resolved desired-schema model shared by the SQL sync
 * projections (postgres, mysql, sqlite).
 *
 * The shared core (`projectDesiredSchemaModel`) produces this model with every
 * value already resolved through the driver's `SyncDialect`; each driver then
 * maps it mechanically (rename / regroup / drop — zero decisions) onto its own
 * `Desired*` types. The `origin` / `kind` provenance markers are load-bearing:
 * mappers use them to reproduce dialect-specific optional-key presence and
 * constraint ordering byte-identically.
 */

/** How a column entered the projection — drives per-dialect optional-key rules. */
export type DesiredColumnOrigin =
  | "field" // declared @Field on the entity (or merged subtype field)
  | "fk" // auto-generated FK column (relation, join-table side, collection parent)
  | "typed_json" // companion column for a typedJson field
  | "ordinal" // collection-table `__ordinal` ordering column
  | "element" // collection-table column from an @Embeddable element field
  | "value"; // collection-table `value` column for primitive elements

export type DesiredColumnModel = {
  name: string;
  columnType: string;
  nullable: boolean;
  defaultExpr: string | null;
  /**
   * DB-assigned strategy. `"identity"` = overridable (pg BY DEFAULT), from
   * `@Generated("increment")`; `"identity_always"` = strict (pg ALWAYS), from
   * `@Generated("identity")`; `"auto_increment"` = mysql/sqlite increment.
   */
  identity: "identity" | "identity_always" | "auto_increment" | null;
  generatedExpr: string | null;
  collation: string | null;
  enumValues: Array<string> | null;
  checkExpr: string | null;
  origin: DesiredColumnOrigin;
};

/** Why a foreign key exists — pg reconstructs constraint ordering from this. */
export type DesiredForeignKeyKind =
  | "inheritance" // joined-child PK → root PK
  | "relation" // owning-side relation FK
  | "join_table" // M2M join-table FK
  | "collection"; // embedded-list parent FK

export type DesiredForeignKeyModel = {
  kind: DesiredForeignKeyKind;
  /** Constraint name — null when the dialect uses unnamed inline FKs (sqlite). */
  name: string | null;
  columns: Array<string>;
  foreignNamespace: string | null;
  foreignTable: string;
  foreignColumns: Array<string>;
  onDelete: string;
  onUpdate: string;
  deferrable: boolean;
  initiallyDeferred: boolean;
};

export type DesiredUniqueModel = {
  name: string;
  columns: Array<{ name: string; prefixLength: number | null }>;
};

export type DesiredCheckModel = {
  name: string;
  expression: string;
};

export type DesiredIndexModel = {
  name: string;
  unique: boolean;
  columns: Array<{
    name: string;
    direction: "asc" | "desc";
    opclass: string | null;
    prefixLength: number | null;
  }>;
  method: string;
  where: string | null;
  include: Array<string> | null;
  concurrent: boolean;
  /** "user" = declared @Index; "auto" = discriminator / join / collection index. */
  origin: "user" | "auto";
};

export type DesiredTriggerModel = {
  name: string;
  /** Standalone DDL statements — sqlite emits exactly one per trigger. */
  statements: Array<string>;
};

export type DesiredEnumModel = {
  schema: string;
  name: string;
  values: Array<string>;
};

export type DesiredPrimaryKeyModel = {
  columns: Array<string>;
};

export type DesiredTableModel = {
  namespace: string | null;
  name: string;
  columns: Array<DesiredColumnModel>;
  /** Null when the dialect omits the PK for this table kind (pg collection tables). */
  primaryKey: DesiredPrimaryKeyModel | null;
  foreignKeys: Array<DesiredForeignKeyModel>;
  uniques: Array<DesiredUniqueModel>;
  checks: Array<DesiredCheckModel>;
  indexes: Array<DesiredIndexModel>;
  comment: string | null;
  columnComments: Record<string, string>;
  triggers: Array<DesiredTriggerModel>;
};

export type DesiredSchemaModel = {
  tables: Array<DesiredTableModel>;
  enums: Array<DesiredEnumModel>;
  namespaces: Array<string>;
  extensions: Array<string>;
};
