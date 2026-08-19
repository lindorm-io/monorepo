import { lindormSymbol } from "@lindorm/utils";

export const STEPS_METADATA = lindormSymbol("gherkin", "marker", "steps");

export const PARAMETER_TYPES_METADATA = lindormSymbol(
  "gherkin",
  "marker",
  "parameter-types",
);

export const HOOKS_METADATA = lindormSymbol("gherkin", "marker", "hooks");

export const INJECTS_METADATA = lindormSymbol("gherkin", "marker", "injects");

export const PRIORITIES_METADATA = lindormSymbol("gherkin", "marker", "priorities");

export const ABSTRACT_STEPS_BRAND = lindormSymbol("gherkin", "brand", "abstract-steps");

export const BINDING_BRAND = lindormSymbol("gherkin", "brand", "binding");

export const CONTEXT_BRAND = lindormSymbol("gherkin", "brand", "context");

export const PENDING_STEP_BRAND = lindormSymbol("gherkin", "brand", "pending-step");
