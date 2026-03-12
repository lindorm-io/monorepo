import { EntityMetadataError } from "../errors/EntityMetadataError";
import type { MetaField } from "../types/metadata";

export const validatePrimaryKeys = (
  targetName: string,
  primaryKeys: Array<string>,
  fields: Array<MetaField>,
): void => {
  if (!primaryKeys.length) {
    throw new EntityMetadataError("Invalid @Entity", {
      details: "Primary key not found",
      debug: { target: targetName },
    });
  }

  for (const key of primaryKeys) {
    if (fields.find((f) => f.key === key)) continue;
    throw new EntityMetadataError("Primary key field not found", {
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
        debug: { target: targetName, key },
      });
    }

    if (!primaryKeys.includes(key)) {
      throw new EntityMetadataError("Version key must also be a primary key", {
        details: "Each @VersionKey must reference a field that is also a @PrimaryKey",
        debug: { target: targetName, key },
      });
    }
  }
};
