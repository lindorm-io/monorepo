import { ProteusError } from "../../../../../errors/index.js";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveColumnNameSafe } from "../resolve-column-name.js";

const mapOnDelete = (onDestroy: MetaRelation["options"]["onDestroy"]): string => {
  switch (onDestroy) {
    case "cascade":
      return "CASCADE";
    case "restrict":
      return "RESTRICT";
    case "set_null":
      return "SET NULL";
    case "set_default":
      return "SET DEFAULT";
    case "ignore":
      return "NO ACTION";
    default:
      throw new ProteusError(`Unsupported onDestroy value: "${onDestroy as string}"`);
  }
};

const mapOnUpdate = (onUpdate: MetaRelation["options"]["onUpdate"]): string => {
  switch (onUpdate) {
    case "cascade":
      return "CASCADE";
    case "restrict":
      return "RESTRICT";
    case "set_null":
      return "SET NULL";
    case "set_default":
      return "SET DEFAULT";
    case "ignore":
      return "NO ACTION";
    default:
      throw new ProteusError(`Unsupported onUpdate value: "${onUpdate as string}"`);
  }
};

/**
 * Generates inline `FOREIGN KEY (...) REFERENCES ...` clauses for use inside
 * `CREATE TABLE`. In SQLite, FK constraints are always inline — there is no
 * `ALTER TABLE ... ADD CONSTRAINT FOREIGN KEY` support.
 *
 * Processes owning-side relations (joinKeys !== null, not ManyToMany).
 */
export const generateInlineFkDDL = (
  metadata: EntityMetadata,
  namespaceOptions?: NamespaceOptions,
): Array<string> => {
  const statements: Array<string> = [];

  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    const foreignName = getEntityName(
      relation.foreignConstructor(),
      namespaceOptions ?? {},
    );
    const foreignTable = quoteIdentifier(foreignName.name);

    const foreignMeta = getEntityMetadata(relation.foreignConstructor());

    for (const [joinCol, foreignPk] of Object.entries(relation.joinKeys)) {
      const resolvedJoinCol = resolveColumnNameSafe(metadata.fields, joinCol);
      const resolvedForeignPk = resolveColumnNameSafe(foreignMeta.fields, foreignPk);
      const onDelete = mapOnDelete(relation.options.onDestroy);
      const onUpdate = mapOnUpdate(relation.options.onUpdate);

      statements.push(
        `FOREIGN KEY (${quoteIdentifier(resolvedJoinCol)}) REFERENCES ${foreignTable}` +
          ` (${quoteIdentifier(resolvedForeignPk)}) ON DELETE ${onDelete} ON UPDATE ${onUpdate}`,
      );
    }
  }

  return statements;
};

/**
 * Maps an onDestroy/onUpdate action value to its SQL keyword.
 * Exported for use by other DDL generators (e.g. join table DDL).
 */
export const mapFkOnDelete = mapOnDelete;
export const mapFkOnUpdate = mapOnUpdate;
