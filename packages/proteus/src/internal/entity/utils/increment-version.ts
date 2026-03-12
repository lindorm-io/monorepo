import { isNumber } from "@lindorm/is";
import { ProteusError } from "../../../errors";
import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "../types/metadata";

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
      { debug: { key: versionField.key, version } },
    );
  }

  (entity as any)[versionField.key] = version + 1;
};
