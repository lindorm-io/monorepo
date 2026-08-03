import type { MetaEmbeddedList, MetaField } from "../types/metadata.js";
import { dehydrateFieldValue } from "./dehydrate-field-value.js";

/**
 * Write-side value pipeline for ONE @EmbeddedList collection-table column — the
 * shared `dehydrateFieldValue` with the collection table standing in for the
 * entity. Every column of that table goes through it: the element columns, and
 * the parent FK column (whose field is the parent's PK, so a `@Transform`ed PK
 * lands in the FK exactly as it landed in the column it references).
 *
 * `field` is nullable because the parent PK is looked up by key and a PK without
 * a declared field resolves to nothing; the pipeline degrades to the driver's
 * coercion alone, which is what the raw push did before.
 *
 * Every driver used to hand-roll this as a bare `transform.to`, which skipped
 * the driver's own write coercion entirely: a `@Field("timestamp")` element
 * reached better-sqlite3 as a live `Date` (which it refuses to bind) and a
 * `@Field("array")` element reached node-postgres as a JS array (which it turns
 * into a Postgres array literal, invalid for a jsonb column) — while the READ
 * side ran the full `deserialise`. The primitive branch skipped even the
 * transform, pushing the element verbatim.
 *
 * `@Encrypted` and `@TypedJson` are unreachable here: `validateElementFields`
 * refuses both on an element field at metadata build, so this path needs neither
 * a vault nor a sidecar half.
 *
 * `undefined` is normalised to `null` — a collection row is written with
 * positional parameters, and a driver binder must never receive `undefined`.
 */
export const dehydrateElementValue = (
  value: unknown,
  field: MetaField | null,
  embeddedList: MetaEmbeddedList,
  coerce?: (value: unknown) => unknown,
): unknown =>
  dehydrateFieldValue(value, field, embeddedList.tableName, { coerce }) ?? null;
