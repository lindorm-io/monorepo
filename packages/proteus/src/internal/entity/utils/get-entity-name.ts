import { snakeCase } from "@lindorm/case";
import { EntityManagerError } from "../errors/EntityManagerError.js";
import type { EntityMetadata } from "../types/metadata.js";
import type { NamespaceOptions, ScopedName } from "../../types/types.js";

/**
 * Resolve an entity's scoped table name from its metadata.
 *
 * Takes the caller's **already naming-resolved** metadata (the source's
 * `resolveMetadata` / `applyNamingStrategy` output) so the table name follows the
 * source's naming strategy: a bare `@Entity()` under `naming: "snake"` resolves
 * `RefreshTokenChain` → `refresh_token_chain`, while `@Entity({ name })` stays
 * verbatim (guaranteed by `metadata.entity.named`). Foreign entities must be
 * resolved through `getForeignMetadata` before being passed here so they follow
 * the same strategy as the owner.
 */
export const getEntityName = (
  metadata: EntityMetadata,
  options: NamespaceOptions,
): ScopedName => {
  const ns = metadata.entity.namespace || options.namespace;

  if (ns === "system") {
    throw new EntityManagerError("The 'system' namespace is reserved for internal use", {
      code: "reserved_namespace",
      title: "Reserved Namespace",
      details:
        "The 'system' namespace is reserved for internal use; choose a different namespace for this entity.",
    });
  }

  const namespace = ns ?? null;
  const name = metadata.entity.name || snakeCase(metadata.target.name);
  const type = snakeCase(metadata.entity.decorator);

  if (namespace && namespace.length > 63) {
    throw new EntityManagerError(`Entity namespace exceeds 63 characters: ${namespace}`, {
      code: "namespace_too_long",
      title: "Namespace Too Long",
      details: `The entity namespace "${namespace}" is ${namespace.length} characters; namespaces must be 63 characters or fewer.`,
      data: { namespace },
    });
  }

  if (name.length > 63) {
    throw new EntityManagerError(`Entity name exceeds 63 characters: ${name}`, {
      code: "name_too_long",
      title: "Name Too Long",
      details: `The entity name "${name}" is ${name.length} characters; entity names must be 63 characters or fewer.`,
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
