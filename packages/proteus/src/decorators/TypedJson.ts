import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata.js";

export type TypedJsonOptions = {
  /** Explicit sidecar column name. Defaults to `<dataColumn>__typemeta`. */
  name?: string;
};

/**
 * Mark a `json` / `object` / `array` field for lossless type fidelity.
 *
 * Applied alongside `@Field("json" | "object" | "array")`. The JSON-safe payload
 * is written to the normal (queryable) data column while the JsonKit type metadata
 * is written to a separate sidecar column, so Date/Buffer/BigInt/undefined round-trip
 * without polluting the queryable column.
 */
export const TypedJson =
  (options?: TypedJsonOptions) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "TypedJson",
      typedJson: { name: options?.name ?? null },
    });
  };
