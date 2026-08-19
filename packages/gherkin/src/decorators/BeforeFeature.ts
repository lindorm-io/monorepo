import { createHookDecorator } from "./create-hook-decorator.js";

/**
 * Run a STATIC method before a feature file's scenarios. Per feature FILE,
 * not once per run — each feature compiles to its own module. The optional
 * tag expression is evaluated against the union of the feature's pickle tags;
 * without it, the flat step namespace runs the hook before EVERY feature file
 * in the package. May be async; awaited.
 */
export const BeforeFeature = createHookDecorator("BeforeFeature", true);
