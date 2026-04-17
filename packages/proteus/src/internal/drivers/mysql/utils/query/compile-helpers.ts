import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import {
  buildDiscriminatorPredicateQualified as sharedBuildDiscQualified,
  buildDiscriminatorPredicateUnqualified as sharedBuildDiscUnqualified,
  buildPrimaryKeyConditions as sharedBuildPk,
  buildPrimaryKeyConditionsQualified as sharedBuildPkQualified,
  getDiscriminatorColumnName,
} from "../../../../utils/sql/compile-helpers";
import { mysqlDialect } from "../mysql-dialect";

export { getDiscriminatorColumnName };

export const buildDiscriminatorPredicateQualified = (
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
): string | null => sharedBuildDiscQualified(metadata, tableAlias, params, mysqlDialect);

export const buildDiscriminatorPredicateUnqualified = (
  metadata: EntityMetadata,
  params: Array<unknown>,
): string | null => sharedBuildDiscUnqualified(metadata, params, mysqlDialect);

export const buildPrimaryKeyConditionsQualified = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  params: Array<unknown>,
  tableAlias: string,
): Array<string> =>
  sharedBuildPkQualified(entity, metadata, params, tableAlias, mysqlDialect);

export const buildPrimaryKeyConditions = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  params: Array<unknown>,
): Array<string> => sharedBuildPk(entity, metadata, params, mysqlDialect);
