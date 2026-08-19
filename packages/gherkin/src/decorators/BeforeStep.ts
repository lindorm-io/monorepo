import { createHookDecorator } from "./create-hook-decorator.js";

/**
 * Run an INSTANCE method before each step of a matching scenario. Receives
 * `(step: StepInfo)` — step identity changes on every step, so it arrives as
 * an argument, never as an injected token. Fires only for steps dispatched
 * to a definition. May be async; awaited.
 */
export const BeforeStep = createHookDecorator("BeforeStep", false);
