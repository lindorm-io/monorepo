import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { SaveStrategy } from "../../types/types.js";
import { EntityManagerError } from "../errors/EntityManagerError.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

export const getSaveStrategy = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): SaveStrategy => {
  const metadata = getEntityMetadata(target);
  const generate = metadata.generated.map((g) => entity[g.key]);
  const version = metadata.fields.find((f) => f.decorator === "Version");

  if (version) {
    const versionValue = entity[version.key];

    if (
      versionValue != null &&
      (typeof versionValue !== "number" ||
        versionValue < 0 ||
        !Number.isFinite(versionValue))
    ) {
      throw new EntityManagerError("Corrupted version value", {
        debug: {
          key: version.key,
          value: versionValue,
          entity: metadata.entity.name,
        },
      });
    }

    if (versionValue === 0) return "insert";
    if (versionValue > 0) return "update";
  }

  if (generate.length && generate.some((v) => v == null)) {
    return "insert";
  }
  if (generate.length && generate.every((v) => v != null)) {
    return "update";
  }
  return "unknown";
};
