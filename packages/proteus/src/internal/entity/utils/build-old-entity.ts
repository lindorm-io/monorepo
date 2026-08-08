import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata, MetaField } from "../types/metadata.js";
import {
  resolveSnapshotValue,
  snapshotLocatorForField,
  snapshotLocatorForJoinKey,
} from "./snapshot-locator.js";

/**
 * Reconstruct the entity as it was when it was last hydrated, for the
 * `oldEntity` carried by `entity:before-update` / `entity:after-update`.
 *
 * The caller mutates its own instance before calling `update()`, so the
 * argument is ALREADY the new state — the prior values only survive in the
 * hydration snapshot. This overlays those onto a copy.
 *
 * - Returns `undefined` when the entity was never hydrated (no snapshot):
 *   there is no prior state to report.
 * - ALWAYS returns a copy, never the caller's instance, so a subscriber that
 *   mutates `oldEntity` cannot corrupt the entity being saved.
 * - A column the snapshot never carried (partial projection) keeps the
 *   entity's current value rather than being clobbered with `undefined`.
 *
 * Nested values ARE faithful, including an @Embedded parent's: hydration
 * detaches every mutable snapshot value from the entity (`copySnapshotValue`),
 * so an in-place mutation of `entity.address.street` no longer overwrites the
 * prior value on its way past.
 */
export const buildOldEntity = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  snapshot: Dict | null,
): E | undefined => {
  if (!snapshot) return undefined;

  const old = copyEntity(entity);
  const embeddedGroups = new Map<string, Array<MetaField>>();

  for (const field of metadata.fields) {
    if (field.embedded) {
      const group = embeddedGroups.get(field.embedded.parentKey) ?? [];
      group.push(field);
      embeddedGroups.set(field.embedded.parentKey, group);
      continue;
    }

    const { present, value } = resolveSnapshotValue(
      snapshot,
      snapshotLocatorForField(field),
    );

    if (present) old[field.key] = value;
  }

  for (const [parentKey, groupFields] of embeddedGroups) {
    if (!(parentKey in snapshot)) continue;

    if (snapshot[parentKey] == null) {
      old[parentKey] = null;
      continue;
    }

    const Embeddable = groupFields[0].embedded!.constructor();
    const instance = new Embeddable() as Dict;

    for (const field of groupFields) {
      instance[field.key.split(".")[1]] = resolveSnapshotValue(
        snapshot,
        snapshotLocatorForField(field),
      ).value;
    }

    old[parentKey] = instance;
  }

  for (const relation of metadata.relations) {
    if (!relation.joinKeys || relation.type === "ManyToMany") continue;

    for (const columnKey of Object.keys(relation.joinKeys)) {
      const locator = snapshotLocatorForJoinKey(metadata.fields, columnKey);
      const { present, value } = resolveSnapshotValue(snapshot, locator);

      if (present) old[locator.propertyKey] = value;
    }
  }

  return old as E;
};

/**
 * Own enumerable properties onto a fresh instance of the same prototype, so
 * the copy stays an entity (hooks, brands and accessors keep working) instead
 * of decaying into a plain object.
 */
const copyEntity = <E extends IEntity>(entity: E): Dict => {
  const copy = Object.create(Object.getPrototypeOf(entity)) as Dict;

  for (const [key, value] of Object.entries(entity)) {
    copy[key] = value;
  }

  return copy;
};
