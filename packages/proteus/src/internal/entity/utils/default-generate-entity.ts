import type { Constructor, DeepPartial } from "@lindorm/types";
import { randomBytes, randomInt, randomUUID } from "crypto";
import { IEntity } from "../../../interfaces";
import type { MetaGenerated } from "../types/metadata";
import { getEntityMetadata } from "../metadata/get-entity-metadata";

const generate = (config: MetaGenerated): any => {
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
    (entity as any)[config.key] = generate(config);
  }
  return entity as E;
};
