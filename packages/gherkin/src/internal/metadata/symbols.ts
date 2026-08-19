import { lindormSymbol } from "@lindorm/utils";

export const STEPS_METADATA = lindormSymbol("gherkin", "marker", "steps");

export const PARAMETER_TYPES_METADATA = lindormSymbol(
  "gherkin",
  "marker",
  "parameter-types",
);

export const BINDING_BRAND = lindormSymbol("gherkin", "brand", "binding");

export const PENDING_STEP_BRAND = lindormSymbol("gherkin", "brand", "pending-step");
