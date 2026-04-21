import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import {
  buildDiscriminatorPredicateUnqualified as sharedBuildDiscUnqualified,
  buildPrimaryKeyConditions as sharedBuildPk,
  getDiscriminatorColumnName,
} from "../../../../utils/sql/compile-helpers.js";
import { sqliteDialect } from "../sqlite-dialect.js";

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
