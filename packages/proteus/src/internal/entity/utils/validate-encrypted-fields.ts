import type { IAmphora } from "@lindorm/amphora";
import { ProteusError } from "../../../errors";
import type { EntityMetadata } from "../types/metadata";

const SYSTEM_DECORATORS = new Set([
  "Version",
  "CreateDate",
  "UpdateDate",
  "DeleteDate",
  "ExpiryDate",
  "VersionStartDate",
  "VersionEndDate",
]);

export const validateEncryptedFields = (
  entities: Array<EntityMetadata>,
  amphora: IAmphora | undefined,
): void => {
  for (const metadata of entities) {
    const primaryKeySet = new Set(metadata.primaryKeys);

    for (const field of metadata.fields) {
      if (!field.encrypted) continue;

      if (!amphora) {
        throw new ProteusError(
          `Entity "${metadata.entity.name}" has @Encrypted field "${field.key}" but no amphora instance was provided. Pass amphora to ProteusSource options.`,
        );
      }

      if (primaryKeySet.has(field.key)) {
        throw new ProteusError(
          `@Encrypted cannot be used on primary key field "${field.key}" in entity "${metadata.entity.name}"`,
        );
      }

      if (SYSTEM_DECORATORS.has(field.decorator)) {
        throw new ProteusError(
          `@Encrypted cannot be used on ${field.decorator} field "${field.key}" in entity "${metadata.entity.name}"`,
        );
      }

      if (field.computed !== null) {
        throw new ProteusError(
          `@Encrypted cannot be used on computed field "${field.key}" in entity "${metadata.entity.name}"`,
        );
      }
    }
  }
};
