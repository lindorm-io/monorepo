import type { EntityMetadata } from "../../entity/types/metadata";
import { getEntityMetadata } from "../../entity/metadata/get-entity-metadata";
import type { SqlDialect } from "./sql-dialect";

export type ResolvedTable = {
  schema: string | null;
  name: string;
};

export const resolveTableName = (
  metadata: EntityMetadata,
  dialect: SqlDialect,
  namespace?: string | null,
): ResolvedTable => {
  const resolveSchema = (meta: EntityMetadata): string | null =>
    dialect.supportsNamespace ? (meta.entity.namespace ?? namespace ?? null) : null;

  if (metadata.inheritance && metadata.inheritance.discriminatorValue != null) {
    const rootMeta = getEntityMetadata(metadata.inheritance.root);
    return {
      schema: resolveSchema(rootMeta),
      name: rootMeta.entity.name,
    };
  }

  return {
    schema: resolveSchema(metadata),
    name: metadata.entity.name,
  };
};

export const buildDiscriminatorPredicate = (
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
