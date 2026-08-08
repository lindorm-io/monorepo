import type { Dict } from "@lindorm/types";
import type { MetaField } from "../types/metadata.js";
import { resolvePropertyKey } from "./resolve-property-key.js";

/**
 * Where a tracked column's PRIOR value lives inside a hydration snapshot.
 *
 * A snapshot is keyed by entity PROPERTY key, but three shapes exist and they
 * do not collapse into one lookup:
 *
 * - `field`    — a plain field: one top-level key.
 * - `embedded` — an @Embedded field: the dotted key ("address.street") is NOT
 *                in the snapshot. `defaultHydrateEntity` deletes the dotted
 *                keys and stores the reconstructed parent object under
 *                `parentKey`, so the value sits one level down.
 * - `join`     — a relation FK column: `joinKeys` are physical COLUMN names,
 *                which diverge from the property key under the snake strategy.
 *                Snapshots written by `defaultHydrateEntity` use the property
 *                key; the heuristic snapshot in `hydrateRelations` copies
 *                whatever the caller-supplied object literally had, so the
 *                column key is the fallback.
 */
export type SnapshotFieldLocator = { kind: "field"; key: string };
export type SnapshotEmbeddedLocator = {
  kind: "embedded";
  parentKey: string;
  nestedKey: string;
};
export type SnapshotJoinLocator = {
  kind: "join";
  propertyKey: string;
  columnKey: string;
};

export type SnapshotLocator =
  | SnapshotFieldLocator
  | SnapshotEmbeddedLocator
  | SnapshotJoinLocator;

/**
 * A resolved prior value plus whether the snapshot actually carried it.
 *
 * `present` is false when the column was never selected (a partial projection
 * hydrates only the fields it read), which is NOT the same as a stored null —
 * callers that write the value onto an object must not clobber on absence.
 */
export type SnapshotValue = {
  present: boolean;
  value: unknown;
};

export const snapshotLocatorForField = (
  field: MetaField,
): SnapshotFieldLocator | SnapshotEmbeddedLocator =>
  field.embedded
    ? {
        kind: "embedded",
        parentKey: field.embedded.parentKey,
        nestedKey: field.key.split(".")[1],
      }
    : { kind: "field", key: field.key };

export const snapshotLocatorForJoinKey = (
  fields: Array<MetaField>,
  columnKey: string,
): SnapshotJoinLocator => ({
  kind: "join",
  propertyKey: resolvePropertyKey(fields, columnKey),
  columnKey,
});

export const resolveSnapshotValue = (
  snapshot: Dict,
  locator: SnapshotLocator,
): SnapshotValue => {
  switch (locator.kind) {
    case "field":
      return { present: locator.key in snapshot, value: snapshot[locator.key] };

    case "embedded": {
      // A nullish parent yields null rather than undefined so SQL params never
      // receive undefined.
      const parent = snapshot[locator.parentKey];
      return {
        present: locator.parentKey in snapshot,
        value: parent != null ? (parent as Dict)[locator.nestedKey] : null,
      };
    }

    case "join":
      return {
        present: locator.propertyKey in snapshot || locator.columnKey in snapshot,
        value: snapshot[locator.propertyKey] ?? snapshot[locator.columnKey],
      };

    default:
      throw new Error(`Unhandled snapshot locator [ ${JSON.stringify(locator)} ]`);
  }
};
