import { snakeCase } from "@lindorm/case";
import type { Constructor } from "@lindorm/types";
import { EntityManagerError } from "../errors/EntityManagerError.js";
import type { IEntity } from "../../../interfaces/index.js";
import type { NamespaceOptions, ScopedName } from "../../types/types.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

export const getEntityName = <E extends IEntity>(
  target: Constructor<E>,
  options: NamespaceOptions,
): ScopedName => {
  const metadata = getEntityMetadata(target);
  const ns = metadata.entity.namespace || options.namespace;

  if (ns === "system") {
    throw new EntityManagerError("The 'system' namespace is reserved for internal use");
  }

  const namespace = ns ?? null;
  const name = metadata.entity.name || snakeCase(target.name);
  const type = snakeCase(metadata.entity.decorator);

  if (namespace && namespace.length > 63) {
    throw new EntityManagerError(`Entity namespace exceeds 63 characters: ${namespace}`);
  }

  if (name.length > 63) {
    throw new EntityManagerError(`Entity name exceeds 63 characters: ${name}`);
  }

  return {
    namespace,
    name,
    type,
    parts: [...(namespace ? [namespace] : []), type, name],
  };
};
