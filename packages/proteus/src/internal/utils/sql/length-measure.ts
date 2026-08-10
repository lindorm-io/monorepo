import { ProteusError } from "../../../errors/index.js";
import type { MetaField, MetaFieldType } from "../../entity/types/metadata.js";

/**
 * What `$length` counts. The condition language measures three different things
 * under one operator — the elements of an array, the characters of a string and
 * the keys of an object — and which one applies is decided by the DECLARED
 * column type, never by inspecting the stored value.
 *
 * Static dispatch is only possible because a structured column declares `object`
 * or `array` rather than an ambiguous `json`. While both fell through to one
 * column type, no compiler could tell an array column from an object one, and
 * each dialect simply assumed: postgres and sqlite emitted array length for
 * every column (postgres ERRORED on a text or object column, sqlite silently
 * returned nothing), while mysql emitted `JSON_LENGTH`, which counts object keys
 * — right, but by luck rather than by decision.
 */
export type LengthMeasure = "array" | "object" | "string";

/**
 * The column types whose stored value IS a JavaScript string, so that counting
 * characters is the question `$length` asks of them.
 *
 * The network, geometric and xml types are deliberately absent. They are stored
 * as their own database types rather than as text, and "how long is an INET"
 * has no answer the three dialects would agree on — so they join the numeric,
 * boolean, temporal and binary types in having no measurable length at all.
 */
const TEXTUAL_TYPES: ReadonlyArray<MetaFieldType> = [
  "email",
  "enum",
  "lindorm_id",
  "string",
  "text",
  "url",
  "uuid",
  "varchar",
];

const unmeasurable = (fieldKey: string, fieldType: string | null): never => {
  throw new ProteusError(
    `Operator "$length" cannot measure field "${fieldKey}" of type "${fieldType ?? "unknown"}"`,
    {
      code: "invalid_operator_type",
      title: "Invalid Operator Type",
      details:
        "$length counts array elements, string characters or object keys. The column is declared as none of those, so there is nothing to count.",
      data: { operator: "$length", field: fieldKey, fieldType },
    },
  );
};

/**
 * Decide what `$length` measures on a column, or refuse the condition.
 *
 * Refusing is the point for a type with no length: the alternatives are a
 * database error the caller cannot read (postgres), an empty result set that
 * looks like a legitimate answer (sqlite), or a runtime `CASE` that guesses from
 * the stored value — and guessing is what the declared type exists to replace.
 */
export const resolveLengthMeasure = (
  field: MetaField | null,
  fieldKey: string,
): LengthMeasure => {
  if (field?.type === "array") return "array";
  if (field?.type === "object") return "object";
  if (field?.type && TEXTUAL_TYPES.includes(field.type)) return "string";

  return unmeasurable(fieldKey, field?.type ?? null);
};
