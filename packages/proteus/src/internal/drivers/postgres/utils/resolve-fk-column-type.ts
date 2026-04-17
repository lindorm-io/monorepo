import type { Constructor } from "@lindorm/types";
import { ProteusError } from "../../../../errors";
import type { IEntity } from "../../../../interfaces";
import type { NamespaceOptions } from "../../../types/types";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata";
import { getEntityName } from "../../../entity/utils/get-entity-name";
import { mapFieldType } from "./map-field-type";

/**
 * Resolves the PostgreSQL column type for a foreign key column by looking up the
 * referenced entity's primary key field and mapping its type. The `foreignPkKey`
 * parameter is the **property key** (e.g. `"id"`), not the column name.
 */
export const resolveFkColumnType = (
  foreignConstructor: () => Constructor<IEntity>,
  foreignPkKey: string,
  namespaceOptions: NamespaceOptions,
): string => {
  const foreignTarget = foreignConstructor();
  const foreignMeta = getEntityMetadata(foreignTarget);
  const pkField = foreignMeta.fields.find((f) => f.key === foreignPkKey);

  if (!pkField) {
    throw new ProteusError(
      `Foreign primary key field "${foreignPkKey}" not found on ${foreignMeta.entity.name}`,
    );
  }

  const foreignName = getEntityName(foreignTarget, namespaceOptions);
  return mapFieldType(pkField, foreignName.name, foreignName.namespace);
};
