import type { EntityMetadata, MetaField } from "../../entity/types/metadata.js";
import type { NamespaceOptions, ScopedName } from "../../types/types.js";
import { getEntityName } from "../../entity/utils/get-entity-name.js";
import { getForeignMetadata } from "../../entity/metadata/foreign-metadata.js";

export type JoinedChildContext = {
  isJoinedChild: boolean;
  rootFieldKeys: Set<string> | null;
  rootMeta: EntityMetadata | null;
  rootEntityName: ScopedName | null;
  /** Child-specific fields + PK for joined children; all fields otherwise. */
  effectiveFields: Array<MetaField>;
};

/**
 * Determines whether `metadata` is a joined-inheritance child entity. Joined
 * children get their own table with ONLY child-specific fields + PK (which is
 * also FK to root) — root fields are managed by the root's table projection.
 */
export const resolveJoinedChildContext = (
  metadata: EntityMetadata,
  namespaceOptions: NamespaceOptions,
): JoinedChildContext => {
  const isJoinedChild =
    metadata.inheritance?.strategy === "joined" &&
    metadata.inheritance.discriminatorValue != null;

  if (!isJoinedChild) {
    return {
      isJoinedChild: false,
      rootFieldKeys: null,
      rootMeta: null,
      rootEntityName: null,
      effectiveFields: metadata.fields,
    };
  }

  const rootMeta = getForeignMetadata(metadata, metadata.inheritance!.root);
  const rootFieldKeys = new Set(rootMeta.fields.map((f) => f.key));
  const rootEntityName = getEntityName(rootMeta, namespaceOptions);

  const effectiveFields = metadata.fields.filter(
    (f) => metadata.primaryKeys.includes(f.key) || !rootFieldKeys.has(f.key),
  );

  return {
    isJoinedChild: true,
    rootFieldKeys,
    rootMeta,
    rootEntityName,
    effectiveFields,
  };
};
