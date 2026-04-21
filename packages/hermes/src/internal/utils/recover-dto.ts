import type { ClassLike, Constructor } from "@lindorm/types";
import type { HermesRegistry } from "../registry/index.js";
import type { HermesCommandMessage } from "../messages/index.js";
import type { HermesEventMessage } from "../messages/index.js";

export const recoverCommand = (
  registry: HermesRegistry,
  message: HermesCommandMessage,
): ClassLike => {
  const metadata = registry.getCommandByName(message.name, message.version);
  return hydrateDtoInstance(metadata.target, message.data);
};

export const recoverEvent = (
  registry: HermesRegistry,
  message: HermesEventMessage,
): ClassLike => {
  const metadata = registry.getEventByName(message.name, message.version);
  return hydrateDtoInstance(metadata.target, message.data);
};

const hydrateDtoInstance = (
  target: Constructor,
  data: Record<string, unknown>,
): ClassLike => {
  const dto = new target();

  for (const [key, value] of Object.entries(data)) {
    dto[key] = value;
  }

  return dto;
};
