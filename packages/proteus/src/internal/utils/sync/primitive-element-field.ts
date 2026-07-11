import type { MetaField, MetaFieldType } from "../../entity/types/metadata.js";

/**
 * Synthetic `MetaField` for a primitive embedded-list element — the single
 * "value" column of a collection table. One canonical literal shared by all
 * SQL dialects (previously pasted into each driver's projection).
 */
export const buildPrimitiveElementField = (elementType: MetaFieldType): MetaField => ({
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
  transform: null,
  typedJson: null,
  type: elementType,
});
