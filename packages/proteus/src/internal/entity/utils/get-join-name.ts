import { EntityManagerError } from "../errors/EntityManagerError.js";
import type { NamespaceOptions, ScopedName } from "../../types/types.js";

export const getJoinName = (joinTable: string, options: NamespaceOptions): ScopedName => {
  const ns = options.namespace;

  if (ns === "system") {
    throw new EntityManagerError("The 'system' namespace is reserved for internal use");
  }

  const namespace = ns ?? null;
  const name = joinTable;
  const type = "join";

  if (namespace && namespace.length > 63) {
    throw new EntityManagerError(`Join namespace exceeds 63 characters: ${namespace}`);
  }

  if (name.length > 63) {
    throw new EntityManagerError(`Join name exceeds 63 characters: ${name}`);
  }

  return {
    namespace,
    name,
    type,
    parts: [...(namespace ? [namespace] : []), type, name],
  };
};
