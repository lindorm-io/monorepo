import { createStepDecorator } from "./create-step-decorator.js";

/**
 * Declare a step definition matched by a Cucumber Expression, on an INSTANCE
 * method of a `@Binding` class. See `Given` — the keyword is decorative.
 */
export const Then = createStepDecorator("Then");
