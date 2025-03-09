import { snakeCase } from "@lindorm/case";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

type Options = {
  namespace?: string | null;
};

export const getCollectionName = <E extends IEntity>(
  Entity: Constructor<E>,
  options: Options,
): string => {
  const metadata = globalEntityMetadata.get(Entity);
  const namespace = metadata.entity.namespace || options.namespace;
  const entityName = metadata.entity.name || Entity.name;
  const decorator = metadata.entity.decorator;

  if (namespace === "system") {
    throw new Error("The 'system' namespace is reserved for internal use");
  }

  const n = namespace ? `${snakeCase(namespace)}.` : "";
  const d = decorator ? `${snakeCase(decorator)}.` : "";
  const e = snakeCase(entityName);

  const name = `${n}${d}${e}`;

  if (name.length > 120) {
    throw new Error(`Collection name exceeds 120 characters: ${name}`);
  }

  return name;
};
