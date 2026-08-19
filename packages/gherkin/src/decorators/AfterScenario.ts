import { createHookDecorator } from "./create-hook-decorator.js";

/**
 * Run an INSTANCE method after each scenario whose tags match the optional
 * tag expression. Receives `(result: ScenarioResult)` — per-invocation data
 * is an argument, never an injected token, because injection carries
 * scenario-scoped state that must not change mid-scenario. Runs even when a
 * step failed. May be async; awaited.
 */
export const AfterScenario = createHookDecorator("AfterScenario", false);
