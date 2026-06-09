import { EntityManagerError } from "../errors/EntityManagerError.js";
import type { NamespaceOptions, ScopedName } from "../../types/types.js";

export const getJoinName = (joinTable: string, options: NamespaceOptions): ScopedName => {
  const ns = options.namespace;

  if (ns === "system") {
    throw new EntityManagerError("The 'system' namespace is reserved for internal use", {
      code: "reserved_namespace",
      title: "Reserved Namespace",
      details:
        "The 'system' namespace is reserved for internal use; choose a different namespace for this join table.",
    });
  }

  const namespace = ns ?? null;
  const name = joinTable;
  const type = "join";

  if (namespace && namespace.length > 63) {
    throw new EntityManagerError(`Join namespace exceeds 63 characters: ${namespace}`, {
      code: "namespace_too_long",
      title: "Namespace Too Long",
      details: `The join namespace "${namespace}" is ${namespace.length} characters; namespaces must be 63 characters or fewer.`,
      data: { namespace },
    });
  }

  if (name.length > 63) {
    throw new EntityManagerError(`Join name exceeds 63 characters: ${name}`, {
      code: "name_too_long",
      title: "Name Too Long",
      details: `The join table name "${name}" is ${name.length} characters; join names must be 63 characters or fewer.`,
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
