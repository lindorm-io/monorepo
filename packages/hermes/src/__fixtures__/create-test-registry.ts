import { join } from "path";
import { HermesRegistry } from "../classes/private";

export const createTestRegistry = (namespace?: string) => {
  const registry = new HermesRegistry({ namespace });

  registry.add([join(__dirname, "modules")]);

  return registry;
};
