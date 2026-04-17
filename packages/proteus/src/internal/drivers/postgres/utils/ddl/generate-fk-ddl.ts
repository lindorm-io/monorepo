import { ProteusError } from "../../../../../errors";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata";
import type { NamespaceOptions } from "../../../../types/types";
import { getEntityName } from "../../../../entity/utils/get-entity-name";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata";
import { hashIdentifier } from "../hash-identifier";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";

const mapOnDelete = (onDestroy: MetaRelation["options"]["onDestroy"]): string => {
  switch (onDestroy) {
    case "cascade":
      return "ON DELETE CASCADE";
    case "restrict":
      return "ON DELETE RESTRICT";
    case "set_null":
      return "ON DELETE SET NULL";
    case "set_default":
      return "ON DELETE SET DEFAULT";
    case "ignore":
      return "ON DELETE NO ACTION";
    default:
      throw new ProteusError(`Unsupported onDestroy value: "${onDestroy as string}"`);
  }
};

const mapOnUpdate = (onUpdate: MetaRelation["options"]["onUpdate"]): string => {
  switch (onUpdate) {
    case "cascade":
      return "ON UPDATE CASCADE";
    case "restrict":
      return "ON UPDATE RESTRICT";
    case "set_null":
      return "ON UPDATE SET NULL";
    case "set_default":
      return "ON UPDATE SET DEFAULT";
    case "ignore":
      return "ON UPDATE NO ACTION";
    default:
      throw new ProteusError(`Unsupported onUpdate value: "${onUpdate as string}"`);
  }
};

/**
 * Generates `ALTER TABLE ... ADD CONSTRAINT FOREIGN KEY` statements for owning-side
 * relations (joinKeys !== null, not ManyToMany). Each constraint is wrapped in a
 * `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block for
 * idempotent execution. Deferrable constraints append the appropriate clause.
 */
export const generateFkDDL = (
  metadata: EntityMetadata,
  tableName: string,
  namespace: string | null,
  namespaceOptions: NamespaceOptions,
): Array<string> => {
  const qualifiedTable = quoteQualifiedName(namespace, tableName);
  const statements: Array<string> = [];

  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    const foreignName = getEntityName(relation.foreignConstructor(), namespaceOptions);
    const foreignTable = quoteQualifiedName(
      foreignName.namespace ?? namespace,
      foreignName.name,
    );

    const foreignMeta = getEntityMetadata(relation.foreignConstructor());

    for (const [joinCol, foreignPk] of Object.entries(relation.joinKeys)) {
      const resolvedJoinCol = resolveColumnNameSafe(metadata.fields, joinCol);
      const resolvedForeignPk = resolveColumnNameSafe(foreignMeta.fields, foreignPk);
      const constraintName = `fk_${hashIdentifier(`${tableName}_${resolvedJoinCol}`)}`;
      const onDelete = mapOnDelete(relation.options.onDestroy);
      const onUpdate = mapOnUpdate(relation.options.onUpdate);
      const deferrable = relation.options.deferrable
        ? relation.options.initiallyDeferred
          ? " DEFERRABLE INITIALLY DEFERRED"
          : " DEFERRABLE INITIALLY IMMEDIATE"
        : "";

      statements.push(
        `DO $$ BEGIN ALTER TABLE ${qualifiedTable} ADD CONSTRAINT ${quoteIdentifier(constraintName)}` +
          ` FOREIGN KEY (${quoteIdentifier(resolvedJoinCol)}) REFERENCES ${foreignTable}` +
          ` (${quoteIdentifier(resolvedForeignPk)}) ${onDelete} ${onUpdate}${deferrable};` +
          ` EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      );
    }
  }

  return statements;
};
