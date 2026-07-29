import type { IAmphora } from "@lindorm/amphora";
import { isNull } from "@lindorm/is";
import { ProteusError } from "../../../errors/index.js";
import type { EntityMetadata } from "../types/metadata.js";

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
          {
            code: "missing_amphora",
            title: "Missing Amphora",
            details: `Entity "${metadata.entity.name}" declares @Encrypted field "${field.key}" but no amphora was provided; pass amphora to the ProteusSource options.`,
            data: { entity: metadata.entity.name, field: field.key },
          },
        );
      }

      if (primaryKeySet.has(field.key)) {
        throw new ProteusError(
          `@Encrypted cannot be used on primary key field "${field.key}" in entity "${metadata.entity.name}"`,
          {
            code: "invalid_encrypted_field",
            title: "Invalid Encrypted Field",
            details: `Field "${field.key}" on entity "${metadata.entity.name}" is a primary key and cannot be @Encrypted; primary keys must remain queryable.`,
            data: { entity: metadata.entity.name, field: field.key },
          },
        );
      }

      if (SYSTEM_DECORATORS.has(field.decorator)) {
        throw new ProteusError(
          `@Encrypted cannot be used on ${field.decorator} field "${field.key}" in entity "${metadata.entity.name}"`,
          {
            code: "invalid_encrypted_field",
            title: "Invalid Encrypted Field",
            details: `Field "${field.key}" on entity "${metadata.entity.name}" uses the system decorator @${field.decorator} and cannot be @Encrypted; system-managed fields must stay readable.`,
            data: {
              entity: metadata.entity.name,
              field: field.key,
              decorator: field.decorator,
            },
          },
        );
      }

      if (field.computed !== null) {
        throw new ProteusError(
          `@Encrypted cannot be used on computed field "${field.key}" in entity "${metadata.entity.name}"`,
          {
            code: "invalid_encrypted_field",
            title: "Invalid Encrypted Field",
            details: `Field "${field.key}" on entity "${metadata.entity.name}" is computed and cannot be @Encrypted; computed values are derived rather than stored.`,
            data: { entity: metadata.entity.name, field: field.key },
          },
        );
      }

      // The field must NAME its key — outright (`kryptos`) or as a query
      // (`condition`) — from the decorator or the source-level `encryption`
      // default, which is already folded in by the time metadata reaches here.
      // Without one the lookup would degrade to "any internal encryption key,
      // newest first": in a vault that also holds a yearly-rotated cookie key,
      // that IS the cookie key. "Which key encrypts my database" must not have
      // an implicit answer — so fail at source load, not on the first write.
      if (isNull(field.encrypted.kryptos) && isNull(field.encrypted.condition)) {
        throw new ProteusError(
          `Entity "${metadata.entity.name}" has @Encrypted field "${field.key}" but names no encryption key`,
          {
            code: "unnamed_encryption_key",
            title: "Unnamed Encryption Key",
            details: `Field "${field.key}" on entity "${metadata.entity.name}" must name its at-rest encryption key: pass @Encrypted({ kryptos }) or @Encrypted({ condition }), or declare a default with the ProteusSource "encryption" option.`,
            data: { entity: metadata.entity.name, field: field.key },
          },
        );
      }
    }
  }
};
