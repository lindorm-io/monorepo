import { Constructor, DeepPartial } from "@lindorm/types";
import { randomBytes, randomInt, randomUUID } from "crypto";
import { IEntity } from "../interfaces";
import { EntityMetadata, MetaGenerated } from "../types";
import { globalEntityMetadata } from "./global";

const generator = (config: Omit<MetaGenerated, "target">): any => {
  switch (config.strategy) {
    case "date":
      return new Date();

    case "float":
      config.min = config.min ?? 0;
      config.max = config.max ?? 999999;
      return Math.random() * (config.max - config.min) + config.min;

    case "integer":
      config.min = config.min ?? 0;
      config.max = config.max ?? 999999;
      return randomInt(config.min, config.max);

    case "string":
      config.length = config.length ?? 32;
      return randomBytes(config.length).toString("base64url");

    case "uuid":
      return randomUUID();

    default:
      return null;
  }
};

const validator = (
  config: Omit<MetaGenerated, "target">,
  metadata: EntityMetadata,
): void => {
  const column = metadata.columns.find((item) => item.key === config.key);

  if (!column) {
    throw new Error(`Column not found for key: ${config.key}`);
  }

  if (!column.type) return;

  switch (config.strategy) {
    case "date":
      if (column.type === "date") break;
      throw new Error(`Invalid column type for date generation: ${column.type}`);

    case "float":
      if (column.type === "float") break;
      throw new Error(`Invalid column type for int generation: ${column.type}`);

    case "integer":
      if (column.type === "integer") break;
      throw new Error(`Invalid column type for int generation: ${column.type}`);

    case "string":
      if (column.type === "string") break;
      throw new Error(`Invalid column type for string generation: ${column.type}`);

    case "uuid":
      if (column.type === "uuid") break;
      throw new Error(`Invalid column type for uuid generation: ${column.type}`);

    default:
      break;
  }
};

export const defaultGenerateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: DeepPartial<E>,
): E => {
  const metadata = globalEntityMetadata.get(target);

  for (const config of metadata.generated) {
    if (entity[config.key]) continue;

    validator(config, metadata);

    (entity as any)[config.key] = generator(config);
  }

  return entity as E;
};
