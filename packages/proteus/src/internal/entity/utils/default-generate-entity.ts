import { randomId } from "@lindorm/random";
import type { Constructor, DeepPartial } from "@lindorm/types";
import { randomBytes, randomInt, randomUUID } from "crypto";
import type { IEntity } from "../../../interfaces/index.js";
import { EntityManagerError } from "../errors/EntityManagerError.js";
import type { MetaGenerated } from "../types/metadata.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

export const generateValue = (config: MetaGenerated): any => {
  if (config.generator) {
    return config.generator();
  }

  switch (config.strategy) {
    case "date":
      return new Date();

    case "float": {
      const min = config.min ?? 0;
      const max = config.max ?? 999999;
      return Math.random() * (max - min) + min;
    }

    case "identity":
    case "increment":
      return null;

    case "integer": {
      const min = config.min ?? 0;
      const max = config.max ?? 999999;
      return randomInt(min, max);
    }

    case "lindorm_id":
      return randomId({
        namespace: config.namespace ?? undefined,
        length: (config.length ?? 24) as 24,
      });

    case "string": {
      const length = config.length ?? 32;
      return randomBytes(length).toString("base64url");
    }

    case "uuid":
      return randomUUID();

    default:
      return null;
  }
};

export const defaultGenerateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: DeepPartial<E>,
): E => {
  const metadata = getEntityMetadata(target);
  for (const config of metadata.generated) {
    if (entity[config.key] != null) continue;
    if (config.strategy === "increment" || config.strategy === "identity") continue;
    (entity as any)[config.key] = generateValue(config);
  }

  // A primary key with no value AND no generator cannot be satisfied — natural keys
  // must be provided explicitly, generated keys must declare a @Generated strategy.
  // (increment/identity generators legitimately leave the value null here; the DB
  // assigns it on insert, so the presence of any generator passes this guard.)
  for (const key of metadata.primaryKeys) {
    if (entity[key as keyof DeepPartial<E>] != null) continue;
    if (metadata.generated.some((g) => g.key === key)) continue;

    throw new EntityManagerError("Missing primary key value", {
      code: "missing_primary_key_value",
      title: "Missing Primary Key Value",
      details: `Primary key "${key}" on "${metadata.entity.name}" has no value and no generator — add a @Generated(...) to generate it or provide the value explicitly.`,
      debug: { entity: metadata.entity.name, primaryKey: key },
    });
  }

  return entity as E;
};
