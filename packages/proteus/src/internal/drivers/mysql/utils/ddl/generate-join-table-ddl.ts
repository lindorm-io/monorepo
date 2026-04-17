import { isString } from "@lindorm/is";
import { ProteusError } from "../../../../../errors";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import type { NamespaceOptions } from "../../../../types/types";
import { getEntityName } from "../../../../entity/utils/get-entity-name";
import { getJoinName } from "../../../../entity/utils/get-join-name";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata";
import { hashIdentifier } from "../hash-identifier";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";
import { resolveFkColumnType } from "../resolve-fk-column-type";

export type JoinTableDDLOutput = {
  tables: Array<string>;
  indexes: Array<string>;
};

/**
 * Generates `CREATE TABLE IF NOT EXISTS` and reverse-side index DDL for ManyToMany
 * join tables. Only processes owning-side relations where `joinTable` is an explicit
 * string name (skips inverse-side `joinTable: true`).
 *
 * MySQL differences from SQLite/PG:
 * - Named FK constraints using hash-based names
 * - No DEFERRABLE
 * - Table options: ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
 * - No IF NOT EXISTS on CREATE INDEX (target 8.0.19+)
 */
export const generateJoinTableDDL = (
  metadata: EntityMetadata,
  namespaceOptions: NamespaceOptions,
): JoinTableDDLOutput => {
  const tables: Array<string> = [];
  const indexes: Array<string> = [];

  for (const relation of metadata.relations) {
    if (relation.type !== "ManyToMany") continue;
    if (!isString(relation.joinTable)) continue;
    if (!relation.joinKeys) continue;

    const joinName = getJoinName(relation.joinTable, namespaceOptions);
    const joinTableQuoted = quoteIdentifier(joinName.name);

    const ownerName = getEntityName(metadata.target, namespaceOptions);
    const ownerTableQuoted = quoteIdentifier(ownerName.name);

    const foreignName = getEntityName(relation.foreignConstructor(), namespaceOptions);
    const foreignTableQuoted = quoteIdentifier(foreignName.name);

    // Get the inverse relation's joinKeys from the foreign entity
    const foreignMeta = getEntityMetadata(relation.foreignConstructor());
    const inverseRelation = foreignMeta.relations.find(
      (r) =>
        r.foreignKey === relation.key &&
        r.key === relation.foreignKey &&
        r.type === "ManyToMany",
    );

    const lines: Array<string> = [];
    const pkCols: Array<string> = [];
    const foreignSideCols: Array<string> = [];

    // Owner-side columns
    for (const [joinCol, ownerPk] of Object.entries(relation.joinKeys)) {
      const colType = resolveFkColumnType(() => metadata.target, ownerPk);
      lines.push(`${quoteIdentifier(joinCol)} ${colType} NOT NULL`);
      pkCols.push(quoteIdentifier(joinCol));
    }

    // Foreign-side columns
    if (!inverseRelation?.joinKeys) {
      throw new ProteusError(
        `ManyToMany relation "${relation.key}" on "${metadata.target.name}" has no resolvable inverse joinKeys`,
      );
    }

    for (const [joinCol, foreignPk] of Object.entries(inverseRelation.joinKeys)) {
      const colType = resolveFkColumnType(relation.foreignConstructor, foreignPk);
      lines.push(`${quoteIdentifier(joinCol)} ${colType} NOT NULL`);
      pkCols.push(quoteIdentifier(joinCol));
      foreignSideCols.push(joinCol);
    }

    // FK constraints for owner-side columns
    for (const [joinCol, ownerPk] of Object.entries(relation.joinKeys)) {
      const resolvedOwnerPk = resolveColumnNameSafe(metadata.fields, ownerPk);
      const fkName = `fk_${hashIdentifier(`${joinName.name}_${joinCol}_${ownerName.name}_${resolvedOwnerPk}`)}`;
      lines.push(
        `CONSTRAINT ${quoteIdentifier(fkName)} FOREIGN KEY (${quoteIdentifier(joinCol)})` +
          ` REFERENCES ${ownerTableQuoted} (${quoteIdentifier(resolvedOwnerPk)})` +
          ` ON DELETE CASCADE ON UPDATE CASCADE`,
      );
    }

    // FK constraints for foreign-side columns
    for (const [joinCol, foreignPk] of Object.entries(inverseRelation.joinKeys)) {
      const resolvedForeignPk = resolveColumnNameSafe(foreignMeta.fields, foreignPk);
      const fkName = `fk_${hashIdentifier(`${joinName.name}_${joinCol}_${foreignName.name}_${resolvedForeignPk}`)}`;
      lines.push(
        `CONSTRAINT ${quoteIdentifier(fkName)} FOREIGN KEY (${quoteIdentifier(joinCol)})` +
          ` REFERENCES ${foreignTableQuoted} (${quoteIdentifier(resolvedForeignPk)})` +
          ` ON DELETE CASCADE ON UPDATE CASCADE`,
      );
    }

    const body = lines.map((l) => `  ${l}`).join(",\n");
    tables.push(
      `CREATE TABLE IF NOT EXISTS ${joinTableQuoted} (\n${body},\n  PRIMARY KEY (${pkCols.join(", ")})\n)` +
        ` ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    // Reverse-side index on foreign FK column(s) — owner-side is covered by the composite PK
    if (foreignSideCols.length > 0) {
      const indexName = `idx_${hashIdentifier(`${joinName.name}_${foreignSideCols.join("_")}`)}`;
      const indexCols = foreignSideCols.map(quoteIdentifier).join(", ");
      indexes.push(
        `CREATE INDEX ${quoteIdentifier(indexName)} ON ${joinTableQuoted} (${indexCols});`,
      );
    }
  }

  return { tables, indexes };
};
