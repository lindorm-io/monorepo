import { snakeCase } from "@lindorm/case";
import type { Constructor } from "@lindorm/types";
import { EntityManagerError } from "../errors/EntityManagerError.js";
import type { IEntity } from "../../../interfaces/index.js";
import type { NamespaceOptions, ScopedName } from "../../types/types.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

export const getIncrementName = <E extends IEntity>(
  target: Constructor<E>,
  options: NamespaceOptions,
): ScopedName => {
  const metadata = getEntityMetadata(target);
  const ns = metadata.entity.namespace || options.namespace;

  if (ns === "system") {
    throw new EntityManagerError("The 'system' namespace is reserved for internal use", {
      code: "reserved_namespace",
      title: "Reserved Namespace",
      details:
        "The 'system' namespace is reserved for internal use; choose a different namespace for this entity's increment sequence.",
    });
  }

  const namespace = ns ?? null;
  const name = metadata.entity.name || snakeCase(target.name);
  const type = "increment";

  if (namespace && namespace.length > 63) {
    throw new EntityManagerError(
      `Increment namespace exceeds 63 characters: ${namespace}`,
      {
        code: "namespace_too_long",
        title: "Namespace Too Long",
        details: `The increment namespace "${namespace}" is ${namespace.length} characters; namespaces must be 63 characters or fewer.`,
        data: { namespace },
      },
    );
  }

  if (name.length > 63) {
    throw new EntityManagerError(`Increment name exceeds 63 characters: ${name}`, {
      code: "name_too_long",
      title: "Name Too Long",
      details: `The increment name "${name}" is ${name.length} characters; increment names must be 63 characters or fewer.`,
      data: { name },
    });
  }

  return {
    namespace,
    name,
    type,
    parts: [...(namespace ? [namespace] : []), type, name],
  };
};
