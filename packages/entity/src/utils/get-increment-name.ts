import { snakeCase } from "@lindorm/case";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

type Options = {
  namespace?: string | null;
};

export const getIncrementName = <E extends IEntity>(
  Entity: Constructor<E>,
  options: Options,
): string => {
  const metadata = globalEntityMetadata.get(Entity);
  const namespace = metadata.entity.namespace || options.namespace;
  const entityName = metadata.entity.name || Entity.name;

  if (namespace === "system") {
    throw new Error("The 'system' namespace is reserved for internal use");
  }

  const n = namespace ? `${snakeCase(namespace)}.` : "";
  const e = snakeCase(entityName);

  const name = `${n}increment.${e}`;

  if (name.length > 120) {
    throw new Error(`Increment name exceeds 120 characters: ${name}`);
  }

  return name;
};
