import { isNumber } from "@lindorm/is";
import { ProteusError } from "../../../errors/index.js";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../types/metadata.js";

export const incrementVersion = <E extends IEntity>(
  metadata: EntityMetadata,
  entity: E,
): void => {
  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (!versionField) return;

  const current = (entity as any)[versionField.key];
  const version = isNumber(current) ? current : 0;

  if (!Number.isInteger(version) || version < 0) {
    throw new ProteusError(
      `Invalid version number: ${version}. Version must be a non-negative integer.`,
      {
        code: "invalid_version",
        title: "Invalid Version",
        details: `The @Version field "${versionField.key}" holds a value that is not a non-negative integer and cannot be incremented; version numbers must be whole numbers of zero or greater.`,
        data: { key: versionField.key, version },
      },
    );
  }

  (entity as any)[versionField.key] = version + 1;
};
