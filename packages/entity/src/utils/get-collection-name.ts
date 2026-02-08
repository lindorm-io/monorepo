import { snakeCase } from "@lindorm/case";
import { Constructor } from "@lindorm/types";
import { EntityKitError } from "../errors";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

type Options = {
  namespace?: string | null;
};

export const getCollectionName = <E extends IEntity>(
  target: Constructor<E>,
  options: Options,
): string => {
  const metadata = globalEntityMetadata.get(target);
  const namespace = metadata.entity.namespace || options.namespace;
  const entityName = metadata.entity.name || target.name;
  const decorator = metadata.entity.decorator;

  if (namespace === "system") {
    throw new EntityKitError("The 'system' namespace is reserved for internal use");
  }

  const n = namespace ? `${snakeCase(namespace)}.` : "";
  const d = decorator ? `${snakeCase(decorator)}.` : "";
  const e = snakeCase(entityName);

  const name = `${n}${d}${e}`;

  if (name.length > 120) {
    throw new EntityKitError(`Collection name exceeds 120 characters: ${name}`);
  }

  return name;
};
