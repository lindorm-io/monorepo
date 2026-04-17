import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import type { CompiledSql } from "./compiled-sql";
import { resolveTableName } from "./resolve-table-name";
import {
  buildInheritanceAliases,
  compileInheritanceJoin,
} from "./compile-inheritance-join";

/**
 * Compile a SELECT by primary key for an entity instance.
 *
 * MySQL has no RETURNING clause, so write operations (INSERT, UPDATE, UPSERT)
 * must follow up with a SELECT-back to retrieve the hydrated row.
 *
 * For joined inheritance children, this emits a JOIN against the child table
 * so child-specific columns are included in the result.
 */
export const compileSelectByPk = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => {
  return buildSelectByPk(
    metadata,
    namespace,
    (primaryKey) => (entity as any)[primaryKey],
  );
};

/**
 * Compile a SELECT by primary key using explicit PK values.
 * Useful when PK values are not on the entity (e.g., AUTO_INCREMENT insertId).
 */
export const compileSelectByPkValues = (
  pkValues: Array<unknown>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => {
  let index = 0;
  return buildSelectByPk(metadata, namespace, () => pkValues[index++]);
};

/**
 * Compile a SELECT for multiple entities by their PKs using an IN (...) clause.
 * Issues a single query instead of N individual SELECTs.
 */
export const compileSelectByPkBatch = <E extends IEntity>(
  entities: Array<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => {
  if (entities.length === 0) {
    throw new Error("compileSelectByPkBatch requires at least one entity");
  }

  const resolved = resolveTableName(metadata, namespace);
  const rootAlias = "t0";
  const rootTable = quoteQualifiedName(resolved.schema, resolved.name);

  const inh = metadata.inheritance;
  const isJoinedChild = inh?.strategy === "joined" && inh.discriminatorValue != null;

  const params: Array<unknown> = [];

  if (metadata.primaryKeys.length === 1) {
    // Single PK: use simple IN (?, ?, ...)
    const pkKey = metadata.primaryKeys[0];
    const field = metadata.fields.find((f) => f.key === pkKey);
    const colName = field?.name ?? pkKey;

    for (const entity of entities) {
      params.push((entity as any)[pkKey]);
    }

    const placeholders = entities.map(() => "?").join(", ");
    const whereClause = `${quoteIdentifier(rootAlias)}.${quoteIdentifier(colName)} IN (${placeholders})`;

    if (!isJoinedChild) {
      const text = `SELECT ${quoteIdentifier(rootAlias)}.* FROM ${rootTable} AS ${quoteIdentifier(rootAlias)} WHERE ${whereClause}`;
      return { text, params };
    }

    const { aliases: inheritanceAliases } = buildInheritanceAliases(
      metadata,
      namespace ?? null,
      1,
    );
    const joinClause = compileInheritanceJoin(metadata, inheritanceAliases, rootAlias);
    const selectParts: Array<string> = [`${quoteIdentifier(rootAlias)}.*`];
    for (const alias of inheritanceAliases) {
      for (const f of alias.childFields) {
        selectParts.push(
          `${quoteIdentifier(alias.tableAlias)}.${quoteIdentifier(f.name)} AS ${quoteIdentifier(f.name)}`,
        );
      }
    }
    const text = `SELECT ${selectParts.join(", ")} FROM ${rootTable} AS ${quoteIdentifier(rootAlias)} ${joinClause} WHERE ${whereClause}`;
    return { text, params };
  }

  // Composite PK: use (pk1, pk2) IN ((?, ?), (?, ?), ...)
  const pkFields = metadata.primaryKeys.map((pk) => {
    const field = metadata.fields.find((f) => f.key === pk);
    return { key: pk, colName: field?.name ?? pk };
  });

  const colTuple = `(${pkFields.map((f) => `${quoteIdentifier(rootAlias)}.${quoteIdentifier(f.colName)}`).join(", ")})`;
  const rowPlaceholders: Array<string> = [];

  for (const entity of entities) {
    for (const pkf of pkFields) {
      params.push((entity as any)[pkf.key]);
    }
    rowPlaceholders.push(`(${pkFields.map(() => "?").join(", ")})`);
  }

  const whereClause = `${colTuple} IN (${rowPlaceholders.join(", ")})`;

  if (!isJoinedChild) {
    const text = `SELECT ${quoteIdentifier(rootAlias)}.* FROM ${rootTable} AS ${quoteIdentifier(rootAlias)} WHERE ${whereClause}`;
    return { text, params };
  }

  const { aliases: inheritanceAliases } = buildInheritanceAliases(
    metadata,
    namespace ?? null,
    1,
  );
  const joinClause = compileInheritanceJoin(metadata, inheritanceAliases, rootAlias);
  const selectParts: Array<string> = [`${quoteIdentifier(rootAlias)}.*`];
  for (const alias of inheritanceAliases) {
    for (const f of alias.childFields) {
      selectParts.push(
        `${quoteIdentifier(alias.tableAlias)}.${quoteIdentifier(f.name)} AS ${quoteIdentifier(f.name)}`,
      );
    }
  }
  const text = `SELECT ${selectParts.join(", ")} FROM ${rootTable} AS ${quoteIdentifier(rootAlias)} ${joinClause} WHERE ${whereClause}`;
  return { text, params };
};

/**
 * Compile a SELECT for AUTO_INCREMENT IDs using >= firstId ORDER BY pk LIMIT N.
 * Safer than BETWEEN because it handles non-contiguous IDs under
 * innodb_autoinc_lock_mode=2 (MySQL 8 default).
 */
export const compileSelectByPkStartLimit = (
  pkColumnName: string,
  firstId: number,
  limit: number,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => {
  const resolved = resolveTableName(metadata, namespace);
  const rootAlias = "t0";
  const rootTable = quoteQualifiedName(resolved.schema, resolved.name);

  const inh = metadata.inheritance;
  const isJoinedChild = inh?.strategy === "joined" && inh.discriminatorValue != null;

  const params: Array<unknown> = [firstId, limit];
  const whereClause = `${quoteIdentifier(rootAlias)}.${quoteIdentifier(pkColumnName)} >= ?`;
  const orderClause = `ORDER BY ${quoteIdentifier(rootAlias)}.${quoteIdentifier(pkColumnName)} ASC LIMIT ?`;

  if (!isJoinedChild) {
    const text = `SELECT ${quoteIdentifier(rootAlias)}.* FROM ${rootTable} AS ${quoteIdentifier(rootAlias)} WHERE ${whereClause} ${orderClause}`;
    return { text, params };
  }

  const { aliases: inheritanceAliases } = buildInheritanceAliases(
    metadata,
    namespace ?? null,
    1,
  );
  const joinClause = compileInheritanceJoin(metadata, inheritanceAliases, rootAlias);
  const selectParts: Array<string> = [`${quoteIdentifier(rootAlias)}.*`];
  for (const alias of inheritanceAliases) {
    for (const f of alias.childFields) {
      selectParts.push(
        `${quoteIdentifier(alias.tableAlias)}.${quoteIdentifier(f.name)} AS ${quoteIdentifier(f.name)}`,
      );
    }
  }
  const text = `SELECT ${selectParts.join(", ")} FROM ${rootTable} AS ${quoteIdentifier(rootAlias)} ${joinClause} WHERE ${whereClause} ${orderClause}`;
  return { text, params };
};

const buildSelectByPk = (
  metadata: EntityMetadata,
  namespace: string | null | undefined,
  getPkValue: (key: string) => unknown,
): CompiledSql => {
  const resolved = resolveTableName(metadata, namespace);
  const rootAlias = "t0";
  const rootTable = quoteQualifiedName(resolved.schema, resolved.name);

  // Build SELECT columns and JOIN for joined inheritance
  const inh = metadata.inheritance;
  const isJoinedChild = inh?.strategy === "joined" && inh.discriminatorValue != null;

  const params: Array<unknown> = [];
  const conditions: Array<string> = [];

  for (const primaryKey of metadata.primaryKeys) {
    const field = metadata.fields.find((f) => f.key === primaryKey);
    const colName = field?.name ?? primaryKey;
    params.push(getPkValue(primaryKey));
    conditions.push(`${quoteIdentifier(rootAlias)}.${quoteIdentifier(colName)} = ?`);
  }

  if (!isJoinedChild) {
    // Simple SELECT * FROM table WHERE pk = ?
    const text = `SELECT ${quoteIdentifier(rootAlias)}.* FROM ${rootTable} AS ${quoteIdentifier(rootAlias)} WHERE ${conditions.join(" AND ")}`;
    return { text, params };
  }

  // Joined inheritance: SELECT root.*, child.child_col1, child.child_col2, ...
  // INNER JOIN child_table ON child.pk = root.pk
  const { aliases: inheritanceAliases } = buildInheritanceAliases(
    metadata,
    namespace ?? null,
    1,
  );

  const joinClause = compileInheritanceJoin(metadata, inheritanceAliases, rootAlias);

  // Build select list: all root columns + child-only columns
  const selectParts: Array<string> = [`${quoteIdentifier(rootAlias)}.*`];

  for (const alias of inheritanceAliases) {
    for (const field of alias.childFields) {
      selectParts.push(
        `${quoteIdentifier(alias.tableAlias)}.${quoteIdentifier(field.name)} AS ${quoteIdentifier(field.name)}`,
      );
    }
  }

  const text = `SELECT ${selectParts.join(", ")} FROM ${rootTable} AS ${quoteIdentifier(rootAlias)} ${joinClause} WHERE ${conditions.join(" AND ")}`;

  return { text, params };
};
