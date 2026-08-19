import { isUndefined } from "@lindorm/is";
import { compileTagExpression } from "./compile-tag-expression.js";
import type { RegistryHook, RegistryHooks, StepModule } from "./types.js";

/**
 * Hooks in the TOTAL order: priority ascending → module path ascending →
 * declaration order within the file. The module-path tiebreak is explicit
 * because registration order alone is `import.meta.glob` key order — a Vite
 * implementation detail that can differ between machines; declaration order
 * survives as the final tiebreak because the sort is stable over the
 * modules-in-path-order collection. Pinned: order-hooks.test.ts.
 */
export const orderHooks = (modules: Array<StepModule>): RegistryHooks => {
  const collected: Array<RegistryHook> = [];

  for (const { modulePath, registrations } of modules) {
    for (const { className, hooks, injects, target } of registrations) {
      for (const hook of hooks) {
        collected.push({
          ...hook,
          className,
          injects,
          // Compiled HERE — at registry build, after every module has loaded —
          // so a malformed expression fails deterministically and anchored
          // (compile-tag-expression.ts), never mid-scenario.
          matches: compileTagExpression({
            className,
            methodName: hook.methodName,
            modulePath,
            ...(isUndefined(hook.tagExpression)
              ? {}
              : { tagExpression: hook.tagExpression }),
          }),
          modulePath,
          target,
        });
      }
    }
  }

  // Code-unit comparison, never localeCompare — the same order on every
  // machine, and the order loadStepModules.ts already loads in.
  collected.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.modulePath < b.modulePath ? -1 : a.modulePath > b.modulePath ? 1 : 0),
  );

  const ordered: RegistryHooks = {
    AfterFeature: [],
    AfterScenario: [],
    AfterStep: [],
    BeforeFeature: [],
    BeforeScenario: [],
    BeforeStep: [],
  };

  for (const hook of collected) {
    ordered[hook.kind].push(hook);
  }

  return ordered;
};
