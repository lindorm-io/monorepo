import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "../../entity/types/metadata";
import type { SqlDialect } from "./sql-dialect";

export const buildDiscriminatorPredicateQualified = (
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
  dialect: SqlDialect,
): string | null => {
  if (!metadata.inheritance) return null;
  if (metadata.inheritance.discriminatorValue == null) return null;

  const field = metadata.fields.find(
    (f) => f.key === metadata.inheritance!.discriminatorField,
  );
  if (!field) return null;

  params.push(metadata.inheritance.discriminatorValue);
  return `${dialect.quoteIdentifier(tableAlias)}.${dialect.quoteIdentifier(field.name)} = ${dialect.placeholder(params)}`;
};

export const buildDiscriminatorPredicateUnqualified = (
  metadata: EntityMetadata,
  params: Array<unknown>,
  dialect: SqlDialect,
): string | null => {
  if (!metadata.inheritance) return null;
  if (metadata.inheritance.discriminatorValue == null) return null;

  const field = metadata.fields.find(
    (f) => f.key === metadata.inheritance!.discriminatorField,
  );
  if (!field) return null;

  params.push(metadata.inheritance.discriminatorValue);
  return `${dialect.quoteIdentifier(field.name)} = ${dialect.placeholder(params)}`;
};

export const buildPrimaryKeyConditionsQualified = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  params: Array<unknown>,
  tableAlias: string,
  dialect: SqlDialect,
): Array<string> =>
  metadata.primaryKeys.map((primaryKey) => {
    const field = metadata.fields.find((f) => f.key === primaryKey);
    const colName = field?.name ?? primaryKey;
    params.push((entity as any)[primaryKey]);
    return `${dialect.quoteIdentifier(tableAlias)}.${dialect.quoteIdentifier(colName)} = ${dialect.placeholder(params)}`;
  });

export const buildPrimaryKeyConditions = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  params: Array<unknown>,
  dialect: SqlDialect,
): Array<string> =>
  metadata.primaryKeys.map((primaryKey) => {
    const field = metadata.fields.find((f) => f.key === primaryKey);
    const colName = field?.name ?? primaryKey;
    params.push((entity as any)[primaryKey]);
    return `${dialect.quoteIdentifier(colName)} = ${dialect.placeholder(params)}`;
  });

export const getDiscriminatorColumnName = (metadata: EntityMetadata): string | null => {
  if (!metadata.inheritance) return null;
  if (metadata.inheritance.discriminatorValue == null) return null;

  const field = metadata.fields.find(
    (f) => f.key === metadata.inheritance!.discriminatorField,
  );
  return field?.name ?? null;
};
