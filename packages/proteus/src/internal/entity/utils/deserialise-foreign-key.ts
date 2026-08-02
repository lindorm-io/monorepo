import { isFunction } from "@lindorm/is";
import { getForeignMetadata } from "../metadata/foreign-metadata.js";
import type { MetaRelation } from "../types/metadata.js";
import { deserialise } from "./deserialise.js";

/**
 * Deserialise a foreign-key value using the REFERENCED primary key's field type.
 *
 * An FK column projected from a relation alone (no `@Field` on the owning entity)
 * has no `MetaField`, so the hydrate field loop never types it — yet the DDL DID
 * type it: `projectColumns` widths the column via `dialect.resolveFkColumnType`,
 * looking up exactly this referenced PK field. Without the same lookup on the read
 * side the driver's wire format leaks through (node-postgres and mysql2 both hand
 * back BIGINT as a string), so a projected bigint FK hydrated as a string while a
 * declared one hydrated as a bigint.
 *
 * `foreignPkKey` is the `joinKeys` VALUE — the referenced entity's property key.
 *
 * Transforms are deliberately NOT applied: the write side (`dehydrateEntity`)
 * writes FK columns without the foreign field's transform, so applying it here
 * would break the round-trip.
 *
 * Lenient by design. The DDL side throws on an unresolvable PK field because a
 * wrong column type is fatal; a read must stay total, so an unresolvable relation
 * (no foreign target, restricted/synthetic metadata) hands the value back verbatim
 * rather than turning a successful read into a throw.
 */
export const deserialiseForeignKey = (
  value: unknown,
  relation: MetaRelation,
  foreignPkKey: string | null,
): unknown => {
  if (value == null) return null;
  if (!foreignPkKey || !isFunction(relation.foreignConstructor)) return value;

  const foreign = getForeignMetadata(relation, relation.foreignConstructor());
  const pkField = foreign.fields.find((f) => f.key === foreignPkKey);

  if (!pkField) return value;

  return deserialise(value, pkField.type, pkField.mode, pkField.arrayType);
};
