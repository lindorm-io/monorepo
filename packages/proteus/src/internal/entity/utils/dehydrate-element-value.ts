import type { MetaEmbeddedList, MetaField } from "../types/metadata.js";
import { dehydrateFieldValue } from "./dehydrate-field-value.js";

/**
 * Write-side value pipeline for ONE @EmbeddedList element column — the shared
 * `dehydrateFieldValue` with the collection table standing in for the entity.
 *
 * Every driver used to hand-roll this as a bare `transform.to`, which skipped
 * the driver's own write coercion entirely: a `@Field("timestamp")` element
 * reached better-sqlite3 as a live `Date` (which it refuses to bind) and a
 * `@Field("array")` element reached node-postgres as a JS array (which it turns
 * into a Postgres array literal, invalid for a jsonb column) — while the READ
 * side ran the full `deserialise`. The primitive branch skipped even the
 * transform, pushing the element verbatim.
 *
 * `@Encrypted` is unreachable here: `validateElementFields` refuses it on an
 * element field at metadata build, so no vault is needed on this path.
 *
 * `undefined` is normalised to `null` — a collection row is written with
 * positional parameters, and a driver binder must never receive `undefined`.
 */
export const dehydrateElementValue = (
  value: unknown,
  field: MetaField,
  embeddedList: MetaEmbeddedList,
  coerce?: (value: unknown) => unknown,
): unknown =>
  dehydrateFieldValue(value, field, embeddedList.tableName, { coerce }) ?? null;
