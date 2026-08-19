import { createHookDecorator } from "./create-hook-decorator.js";

/**
 * Run a STATIC method after a feature file's scenarios. Per feature FILE, not
 * once per run — each feature compiles to its own module. The optional tag
 * expression is evaluated against the union of the feature's pickle tags.
 * May be async; awaited. Runs even when a scenario failed.
 */
export const AfterFeature = createHookDecorator("AfterFeature", true);
