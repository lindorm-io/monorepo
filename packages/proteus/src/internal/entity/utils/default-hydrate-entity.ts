import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { ProteusHookMeta } from "../../../types/proteus-hook-meta.js";
import type { EntityMetadata } from "../types/metadata.js";
import { decryptFieldValue } from "./decrypt-field-value.js";
import { deserialise } from "./deserialise.js";
import { runHooksSync } from "./run-hooks-sync.js";
import { storeSnapshot } from "./snapshot-store.js";

export type HydrateOptions = {
  snapshot?: boolean;
  hooks?: boolean;
  context?: ProteusHookMeta;
  amphora?: IAmphora;
};

/**
 * Convert a flat Dict of { fieldKey: coercedValue } into a typed entity instance.
 *
 * - `data` is keyed by field key (entity property names), not column names.
 *   The driver maps column names → field keys before calling this function.
 * - Absent fields (key not in data) are skipped entirely — not assigned to entity.
 * - Null values are preserved as-is — NOT passed through deserialise (prevents zero-coercion bug).
 * - Non-null values are coerced via deserialise(value, field.type).
 * - FK columns from owning relations are extracted via resolveJoinKeyValue.
 * - Snapshot is stored by default (opt out with { snapshot: false }).
 * - OnHydrate hooks fire by default (opt out with { hooks: false }).
 */
export const defaultHydrateEntity = <E extends IEntity>(
  data: Dict,
  metadata: EntityMetadata,
  options: HydrateOptions = {},
): E => {
  const { snapshot = true, hooks = true, context, amphora } = options;

  const entity = new metadata.target() as any;
  const snapshotDict: Dict = {};

  for (const field of metadata.fields) {
    if (!(field.key in data)) continue;

    let raw = data[field.key];

    if (raw != null && field.encrypted && amphora) {
      raw = decryptFieldValue(raw as string, amphora, field.key, metadata.entity.name);
    }

    if (raw === null || raw === undefined) {
      entity[field.key] = raw;
    } else {
      let value = deserialise(raw, field.type);
      if (field.transform) {
        value = field.transform.from(value);
      }
      entity[field.key] = value;
    }

    snapshotDict[field.key] = entity[field.key];
  }

  // Reconstruct embedded objects from flattened dotted-key fields
  const embeddedGroups = new Map<string, Array<(typeof metadata.fields)[number]>>();
  for (const field of metadata.fields) {
    if (!field.embedded) continue;
    let group = embeddedGroups.get(field.embedded.parentKey);
    if (!group) {
      group = [];
      embeddedGroups.set(field.embedded.parentKey, group);
    }
    group.push(field);
  }

  for (const [parentKey, groupFields] of embeddedGroups) {
    // Check if ALL values are null — if so, the entire embedded object is null
    const allNull = groupFields.every(
      (f) => entity[f.key] === null || entity[f.key] === undefined,
    );

    if (allNull) {
      entity[parentKey] = null;
    } else {
      const EmbeddableConstructor = groupFields[0].embedded!.constructor();
      const instance = new EmbeddableConstructor();
      for (const f of groupFields) {
        const nestedKey = f.key.split(".")[1];
        instance[nestedKey] = entity[f.key];
      }
      entity[parentKey] = instance;
    }

    // Remove the flat dotted-key properties from the entity
    for (const f of groupFields) {
      delete entity[f.key];
    }

    // Update snapshot to use parentKey instead of dotted keys
    for (const f of groupFields) {
      delete snapshotDict[f.key];
    }
    snapshotDict[parentKey] = entity[parentKey];
  }

  // Extract FK columns from owning relations
  for (const relation of metadata.relations) {
    if (!relation.joinKeys || relation.type === "ManyToMany") continue;

    for (const [localKey] of Object.entries(relation.joinKeys)) {
      // Skip if already handled in the field loop (user-declared FK field)
      if (localKey in snapshotDict) continue;

      if (localKey in data) {
        entity[localKey] = data[localKey] ?? null;
        snapshotDict[localKey] = entity[localKey];
      }
    }
  }

  // Sync RelationId hydration — for *ToOne owning relations, FK values are in the row
  for (const ri of metadata.relationIds ?? []) {
    const relation = metadata.relations.find((r) => r.key === ri.relationKey);
    if (!relation) continue;

    // Only sync-hydrate owning *ToOne (joinKeys present, not M2M)
    if (!relation.joinKeys || relation.type === "ManyToMany") continue;

    const entries = Object.entries(relation.joinKeys);
    if (ri.column) {
      // Explicit column — find the matching joinKey entry
      const fkValue = entity[ri.column] ?? data[ri.column] ?? null;
      entity[ri.key] = fkValue;
    } else if (entries.length === 1) {
      // Auto-detect single FK
      const [localKey] = entries[0];
      entity[ri.key] = entity[localKey] ?? data[localKey] ?? null;
    }
    // Composite FK without explicit column — skip (user must specify column)
  }

  if (snapshot) {
    storeSnapshot(entity, snapshotDict);
  }

  if (hooks) {
    runHooksSync("OnHydrate", metadata.hooks, entity, context);
  }

  return entity as E;
};
