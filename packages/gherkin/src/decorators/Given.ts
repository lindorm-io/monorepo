import { createStepDecorator } from "./create-step-decorator.js";

/**
 * Declare a step definition matched by a Cucumber Expression, on an INSTANCE
 * method of a `@Binding` class. The keyword is decorative — matching is
 * text-only, so `@Given`, `@When` and `@Then` are interchangeable at match
 * time and two definitions with identical text are ambiguous regardless of
 * keyword (Cucumber semantics).
 */
export const Given = createStepDecorator("Given");
