import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import {
  buildDiscriminatorPredicateUnqualified as sharedBuildDiscUnqualified,
  buildPrimaryKeyConditions as sharedBuildPk,
  getDiscriminatorColumnName,
} from "#internal/utils/sql/compile-helpers";
import { sqliteDialect } from "../sqlite-dialect";

export { getDiscriminatorColumnName };

export const buildDiscriminatorPredicateUnqualified = (
  metadata: EntityMetadata,
  params: Array<unknown>,
): string | null => sharedBuildDiscUnqualified(metadata, params, sqliteDialect);

export const buildPrimaryKeyConditions = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  params: Array<unknown>,
): Array<string> => sharedBuildPk(entity, metadata, params, sqliteDialect);

export const removeTableAlias = (whereClause: string, alias: string): string => {
  const pattern = new RegExp(`"${alias}"\\.`, "g");
  return whereClause.replace(pattern, "");
};
