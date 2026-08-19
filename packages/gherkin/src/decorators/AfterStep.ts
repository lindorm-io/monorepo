import { createHookDecorator } from "./create-hook-decorator.js";

/**
 * Run an INSTANCE method after each step of a matching scenario. Receives
 * `(step: StepInfo, result: StepResult)` — per-invocation data arrives as
 * arguments so the hook can act conditionally ("capture state if this step
 * failed"). Fires only for steps dispatched to a definition. May be async;
 * awaited.
 */
export const AfterStep = createHookDecorator("AfterStep", false);
