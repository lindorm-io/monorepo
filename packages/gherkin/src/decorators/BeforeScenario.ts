import { createHookDecorator } from "./create-hook-decorator.js";

/**
 * Run an INSTANCE method before each scenario whose tags match the optional
 * tag expression. Declaring an untagged scenario-level hook constructs the
 * class for every scenario in the package — the tag expression is the
 * opt-out. May be async; awaited.
 */
export const BeforeScenario = createHookDecorator("BeforeScenario", false);
