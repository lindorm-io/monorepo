import { drainRegistrations } from "../registry/registrations.js";
import type { StepModule } from "../registry/types.js";

/**
 * Awaits every step-module thunk — importing a module runs its decorators —
 * and drains the pending registrations after EACH import, which is what
 * associates a registration with its module path. Paths load in ascending
 * order so registry order (and with it ambiguous-candidate listings) never
 * depends on the emitter's glob key order. An import failure propagates: a
 * broken step module fails the feature file, and with the flat namespace
 * that is every feature file — broken step definitions are broken.
 */
export const loadStepModules = async (
  stepModules: Record<string, () => Promise<unknown>>,
): Promise<Array<StepModule>> => {
  const modules: Array<StepModule> = [];

  for (const modulePath of Object.keys(stepModules).sort()) {
    await stepModules[modulePath]();
    modules.push({ modulePath, registrations: drainRegistrations() });
  }

  return modules;
};
