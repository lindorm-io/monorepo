import type { EntityMetadata } from "../../entity/types/metadata.js";
import { ProteusError } from "../../../errors/ProteusError.js";
import type { CompiledSql } from "./compiled-sql.js";
import {
  buildDiscriminatorPredicateQualified,
  buildDiscriminatorPredicateUnqualified,
} from "./compile-helpers.js";
import { resolveTableName } from "./resolve-table-name.js";
import type { SqlDialect } from "./sql-dialect.js";

/**
 * Compiles a `DELETE FROM ... WHERE <expiryDate> <= <dateNow>` to purge expired rows.
 * Throws `ProteusError` if the entity has no `@ExpiryDate` field.
 *
 * Uses `dialect.supportsDeleteAlias` to determine whether to use table alias
 * and qualified column names.
 */
export const compileDeleteExpired = (
  metadata: EntityMetadata,
  dialect: SqlDialect,
  namespace?: string | null,
): CompiledSql => {
  const resolved = resolveTableName(metadata, dialect, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);
  const expiryField = metadata.fields.find((f) => f.decorator === "ExpiryDate");
  if (!expiryField) {
    throw new ProteusError(
      `compileDeleteExpired: entity "${metadata.entity.name}" has no @ExpiryDate field`,
    );
  }

  const params: Array<unknown> = [];
  const alias = dialect.supportsDeleteAlias ? "t0" : null;

  const discPredicate = alias
    ? buildDiscriminatorPredicateQualified(metadata, alias, params, dialect)
    : buildDiscriminatorPredicateUnqualified(metadata, params, dialect);
  const discCondition = discPredicate ? ` AND ${discPredicate}` : "";

  const colRef = alias
    ? `${dialect.quoteIdentifier(alias)}.${dialect.quoteIdentifier(expiryField.name)}`
    : dialect.quoteIdentifier(expiryField.name);

  const aliasSuffix = alias ? ` AS ${dialect.quoteIdentifier(alias)}` : "";
  const text = `DELETE FROM ${tableName}${aliasSuffix} WHERE ${colRef} <= ${dialect.dateNowExpression()}${discCondition}`;

  return { text, params };
};
