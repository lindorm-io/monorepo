import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { MetaField } from "../types/metadata.js";

export const validatePrimaryKeys = (
  targetName: string,
  primaryKeys: Array<string>,
  fields: Array<MetaField>,
): void => {
  if (!primaryKeys.length) {
    throw new EntityMetadataError("Invalid @Entity", {
      code: "missing_primary_key",
      title: "Missing Primary Key",
      details: `Entity "${targetName}" declares no primary key — add a @PrimaryKey decorator to one of its fields.`,
      debug: { target: targetName },
    });
  }

  for (const key of primaryKeys) {
    if (fields.find((f) => f.key === key)) continue;
    throw new EntityMetadataError("Primary key field not found", {
      code: "missing_primary_key_field",
      title: "Missing Primary Key Field",
      details: `@PrimaryKey on "${targetName}" references property "${key}", which has no @Field decorator — add a @Field for that property or correct the primary key.`,
      debug: { target: targetName, key },
    });
  }
};

export const validateVersionKeys = (
  targetName: string,
  versionKeys: Array<string>,
  primaryKeys: Array<string>,
  fields: Array<MetaField>,
): void => {
  for (const key of versionKeys) {
    if (!fields.find((f) => f.key === key)) {
      throw new EntityMetadataError("Version key field not found", {
        code: "missing_version_key_field",
        title: "Missing Version Key Field",
        details: `@VersionKey on "${targetName}" references property "${key}", which has no @Field decorator — add a @Field for that property or correct the version key.`,
        debug: { target: targetName, key },
      });
    }

    if (!primaryKeys.includes(key)) {
      throw new EntityMetadataError("Version key must also be a primary key", {
        code: "version_key_not_primary_key",
        title: "Version Key Not Primary Key",
        details: `@VersionKey "${key}" on "${targetName}" must also be a @PrimaryKey — add @PrimaryKey to that field or remove @VersionKey.`,
        debug: { target: targetName, key },
      });
    }
  }
};
