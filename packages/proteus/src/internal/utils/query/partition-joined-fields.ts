import type { EntityMetadata, MetaField } from "../../entity/types/metadata.js";
import { getEntityMetadata } from "../../entity/metadata/get-entity-metadata.js";

export type JoinedFieldPartition = {
  /** Fields that belong to the root table (including PK and discriminator) */
  rootFields: Array<MetaField>;
  /** Fields that belong ONLY to the child table (excluding PK) */
  childFields: Array<MetaField>;
  /** Root entity metadata */
  rootMetadata: EntityMetadata;
};

/**
 * Partition a joined child entity's fields into root-table fields and child-table fields.
 *
 * - Root fields: all fields that exist on the root entity (incl. PK, version, timestamps)
 * - Child fields: fields that do NOT exist on the root entity, excluding PK columns
 *   (PK columns must be inserted into the child table but are derived from root INSERT)
 *
 * Returns null for non-joined-child entities (root entities, single-table, no inheritance).
 */
export const partitionJoinedFields = (
  metadata: EntityMetadata,
): JoinedFieldPartition | null => {
  const inh = metadata.inheritance;
  if (!inh) return null;
  if (inh.strategy !== "joined") return null;
  if (inh.discriminatorValue == null) return null; // This is the root, not a child

  const rootMeta = getEntityMetadata(inh.root);
  const rootFieldKeys = new Set(rootMeta.fields.map((f) => f.key));
  const pkKeys = new Set(metadata.primaryKeys);

  const rootFields: Array<MetaField> = [];
  const childFields: Array<MetaField> = [];

  for (const field of metadata.fields) {
    if (rootFieldKeys.has(field.key)) {
      // This field belongs to the root table
      rootFields.push(field);
    } else if (!pkKeys.has(field.key)) {
      // This field is child-specific (not PK, not root)
      childFields.push(field);
    }
    // PK fields that aren't on root are skipped here — they'll be handled
    // explicitly during INSERT/UPDATE as the join column
  }

  return { rootFields, childFields, rootMetadata: rootMeta };
};
