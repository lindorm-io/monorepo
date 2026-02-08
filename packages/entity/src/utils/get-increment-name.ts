import { snakeCase } from "@lindorm/case";
import { Constructor } from "@lindorm/types";
import { EntityKitError } from "../errors";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

type Options = {
  namespace?: string | null;
};

export const getIncrementName = <E extends IEntity>(
  target: Constructor<E>,
  options: Options,
): string => {
  const metadata = globalEntityMetadata.get(target);
  const namespace = metadata.entity.namespace || options.namespace;
  const entityName = metadata.entity.name || target.name;

  if (namespace === "system") {
    throw new EntityKitError("The 'system' namespace is reserved for internal use");
  }

  const n = namespace ? `${snakeCase(namespace)}.` : "";
  const e = snakeCase(entityName);

  const name = `${n}increment.${e}`;

  if (name.length > 120) {
    throw new EntityKitError(`Increment name exceeds 120 characters: ${name}`);
  }

  return name;
};
