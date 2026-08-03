import type { MetaField, MetaFieldType } from "../types/metadata.js";

/**
 * Synthetic `MetaField` for a primitive embedded-list element — the single
 * "value" column of a collection table. One canonical literal shared by all
 * SQL dialects (previously pasted into each driver's projection), and by the
 * write path, so the element goes through the same dehydrate pipeline as any
 * other column instead of being pushed at the driver verbatim.
 */
export const buildPrimitiveElementField = (
  elementType: MetaFieldType | null,
): MetaField => ({
  key: "value",
  decorator: "Field",
  arrayType: null,
  collation: null,
  comment: null,
  computed: null,
  embedded: null,
  encrypted: null,
  enum: null,
  default: null,
  hideOn: [],
  max: null,
  min: null,
  name: "value",
  named: false,
  nullable: false,
  order: null,
  precision: null,
  readonly: [],
  scale: null,
  schema: null,
  sensitive: null,
  transform: null,
  typedJson: null,
  type: elementType,
});
