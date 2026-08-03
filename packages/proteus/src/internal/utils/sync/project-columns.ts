import type { EntityMetadata, MetaField } from "../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../types/types.js";
import type { DesiredColumnModel } from "./desired-schema-model.js";
import type { JoinedChildContext } from "./joined-child-context.js";
import type { SyncDialect } from "./sync-dialect.js";
import { getForeignMetadata } from "../../entity/metadata/foreign-metadata.js";

export type ProjectColumnsOptions = {
  metadata: EntityMetadata;
  child: JoinedChildContext;
  tableName: string;
  namespace: string | null;
  dialect: SyncDialect;
  namespaceOptions: NamespaceOptions;
};

const projectFieldColumn = (
  field: MetaField,
  options: ProjectColumnsOptions,
): DesiredColumnModel => {
  const { metadata, tableName, namespace, dialect } = options;

  const projected = dialect.projectColumnType(field, tableName, namespace);
  const gen = metadata.generated.find((g) => g.key === field.key);
  const behavior = dialect.projectColumnBehavior(field, gen);

  return {
    name: field.name,
    columnType: projected.type,
    // Embedded child columns must always be nullable in the DDL because the
    // parent object can be null — even when the child's own @Field is non-nullable.
    // The non-nullable constraint for children is enforced by Zod validation at
    // the application layer (when the parent IS present, child fields are required).
    nullable: field.embedded ? true : field.nullable,
    defaultExpr: behavior.defaultExpr,
    identity: behavior.identity,
    generatedExpr: behavior.generatedExpr,
    collation: field.collation,
    enumValues: projected.enumValues,
    checkExpr: projected.checkExpr,
    origin: "field",
  };
};

/**
 * Projects an entity table's columns: declared fields (+ typedJson companion
 * columns) and auto-generated FK columns from owning-side relations, then
 * validates embedded-column/FK-column name collisions. FK columns are only
 * auto-generated when no non-embedded field with the same column name exists.
 */
export const projectColumns = (
  options: ProjectColumnsOptions,
): Array<DesiredColumnModel> => {
  const { metadata, child, dialect, namespaceOptions } = options;
  const { effectiveFields } = child;
  const columns: Array<DesiredColumnModel> = [];

  for (const field of effectiveFields) {
    columns.push(projectFieldColumn(field, options));
    if (field.typedJson) {
      columns.push({
        name: field.typedJson.column,
        // An @Encrypted typed-json field seals its sidecar too, and ciphertext is
        // not JSON — a JSONB/JSON companion column would reject it. Borrow the
        // driver's own encrypted-column spelling rather than restating it, so the
        // sidecar can never drift from the data column beside it.
        columnType: field.encrypted
          ? dialect.projectColumnType(field, options.tableName, options.namespace).type
          : dialect.typedJsonColumnType,
        nullable: true,
        defaultExpr: null,
        identity: null,
        generatedExpr: null,
        collation: null,
        enumValues: null,
        checkExpr: null,
        origin: "typed_json",
      });
    }
  }

  // FK columns from owning-side relations
  // For joined children, skip relations whose FK columns belong to the root table
  const fkColumnNames: Array<string> = [];
  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;
    for (const [joinCol, foreignPk] of Object.entries(relation.joinKeys)) {
      if (child.isJoinedChild && child.rootFieldKeys!.has(joinCol)) continue;
      if (effectiveFields.some((f) => !f.embedded && f.name === joinCol)) continue;
      columns.push({
        name: joinCol,
        columnType: dialect.resolveFkColumnType(
          getForeignMetadata(relation, relation.foreignConstructor()),
          foreignPk,
          namespaceOptions,
        ),
        nullable: relation.options.nullable,
        defaultExpr: null,
        identity: null,
        generatedExpr: null,
        collation: null,
        enumValues: null,
        checkExpr: null,
        origin: "fk",
      });
      fkColumnNames.push(joinCol);
    }
  }

  // Validate: embedded flat column names must not collide with FK column names.
  // validateFields runs before FK columns are added by resolveRelations, so
  // collisions between embedded columns (e.g. "user_id") and relation FK
  // columns (e.g. "user_id") are only detectable here.
  for (const fkCol of fkColumnNames) {
    const colliding = effectiveFields.find((f) => f.embedded && f.name === fkCol);
    if (colliding) {
      throw dialect.embeddedFkCollisionError(fkCol, metadata.target.name, colliding);
    }
  }

  return columns;
};
