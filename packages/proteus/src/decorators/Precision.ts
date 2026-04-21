import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Sets the precision and scale for a numeric field (decimal, float, real).
 *
 * @param precision - Total number of significant digits.
 * @param scale - Number of digits after the decimal point (defaults to 0).
 */
export const Precision =
  (precision: number, scale?: number) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Precision",
      precision,
      scale: scale ?? 0,
    });
  };
