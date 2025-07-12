import { Constructor, DeepPartial } from "@lindorm/types";
import { randomBytes, randomInt, randomUUID } from "crypto";
import { IMessage } from "../interfaces";
import { MessageMetadata, MetaGenerated } from "../types";
import { globalMessageMetadata } from "./global";

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
  metadata: MessageMetadata,
): void => {
  const field = metadata.fields.find((item) => item.key === config.key);

  if (!field) {
    throw new Error(`Field not found for key: ${config.key}`);
  }

  if (!field.type) return;

  switch (config.strategy) {
    case "date":
      if (field.type === "date") break;
      throw new Error(`Invalid field type for date generation: ${field.type}`);

    case "float":
      if (field.type === "float") break;
      throw new Error(`Invalid field type for int generation: ${field.type}`);

    case "integer":
      if (field.type === "integer") break;
      throw new Error(`Invalid field type for int generation: ${field.type}`);

    case "string":
      if (field.type === "string") break;
      throw new Error(`Invalid field type for string generation: ${field.type}`);

    case "uuid":
      if (field.type === "uuid") break;
      throw new Error(`Invalid field type for uuid generation: ${field.type}`);

    default:
      break;
  }
};

export const defaultGenerateMessage = <M extends IMessage>(
  target: Constructor<M>,
  message: DeepPartial<M>,
): M => {
  const metadata = globalMessageMetadata.get(target);

  for (const config of metadata.generated) {
    if (message[config.key]) continue;

    validator(config, metadata);

    (message as any)[config.key] = generator(config);
  }

  return message as M;
};
