import { ProteusError } from "../errors/ProteusError.js";
import type { DiscriminatorValue as DiscriminatorValueType } from "../internal/entity/types/inheritance.js";
import { stageDiscriminatorValue } from "../internal/entity/metadata/stage-metadata.js";

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
      throw new ProteusError(
        `@DiscriminatorValue requires a string or number, received ${typeof value}`,
        {
          code: "invalid_decorator_usage",
          title: "Invalid Decorator Usage",
          details: "@DiscriminatorValue must be given a string or number value.",
          data: { decorator: "DiscriminatorValue" },
        },
      );
    }
    stageDiscriminatorValue(context.metadata, value);
  };
