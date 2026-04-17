import type { DiscriminatorValue as DiscriminatorValueType } from "../internal/entity/types/inheritance";
import { stageDiscriminatorValue } from "../internal/entity/metadata/stage-metadata";

/**
 * Specify the discriminator value for this subtype in a table inheritance hierarchy.
 *
 * Applied to each concrete subclass to identify its rows in the discriminator column.
 *
 * - `@DiscriminatorValue("car")` — rows with discriminator = "car" map to this class
 * - `@DiscriminatorValue(1)` — numeric discriminator values are also supported
 */
export const DiscriminatorValue =
  (value: DiscriminatorValueType) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new TypeError(
        `@DiscriminatorValue requires a string or number, received ${typeof value}`,
      );
    }
    stageDiscriminatorValue(context.metadata, value);
  };
