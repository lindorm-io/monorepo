import type { FeatureSuiteModel } from "../model/types.js";
import type { GherkinRegistry, RegistryHook } from "../registry/types.js";
import { composeFailures } from "./compose-failures.js";
import { formatFeatureHookAnchor } from "./format/format-hook-anchor.js";
import { formatHookFailure } from "./format/format-hook-failure.js";
import { invokeHook } from "./invoke-hook.js";
import type { SuiteApi } from "./types.js";

export type RegisterFeatureHooksOptions = {
  api: SuiteApi;
  model: FeatureSuiteModel;
  registry: GherkinRegistry;
};

const invokeFeatureHook = (hook: RegistryHook, uri: string): Promise<void> =>
  invokeHook({
    args: [],
    format: (message) =>
      formatHookFailure({
        anchor: formatFeatureHookAnchor(hook.className, hook.methodName, uri),
        kind: hook.kind,
        message,
      }),
    hook,
    // STATIC by the lifetime rule (create-hook-decorator.ts scope check) —
    // the class itself is the receiver; no scenario instance exists here.
    instance: hook.target,
  });

/**
 * `@BeforeFeature` / `@AfterFeature` compile to beforeAll/afterAll on the
 * feature file's top-level suite. Tag expressions are evaluated against the
 * feature's pickle-tag union BEFORE registering — a filtered-out hook
 * registers NOTHING, and a feature with no matching hooks keeps a suite
 * surface identical to a hook-free one.
 */
export const registerFeatureHooks = ({
  api,
  model,
  registry,
}: RegisterFeatureHooksOptions): void => {
  const before = registry.hooks.BeforeFeature.filter((hook) => hook.matches(model.tags));
  const after = registry.hooks.AfterFeature.filter((hook) => hook.matches(model.tags));

  if (before.length > 0) {
    // ONE beforeAll callback for all hooks: N separate beforeAll calls also
    // run in registration order under vitest, but a single callback makes the
    // sequential-await TOTAL order (§3.3) explicit in one loop and keeps a
    // throw attributable to its hook via the anchored message rather than to
    // "one of N callbacks". The first throw stops the remaining
    // before-feature hooks — setup halts at the first failure, mirroring
    // @BeforeScenario (run-scenario.ts) — and fails the whole feature.
    api.beforeAll(async () => {
      for (const hook of before) {
        await invokeFeatureHook(hook, model.uri);
      }
    });
  }

  if (after.length > 0) {
    api.afterAll(async () => {
      const failures: Array<Error> = [];

      // REVERSED at execution: RegistryHooks serves every kind ascending
      // (registry/types.ts) — teardown must unwind setup. EVERY after-feature
      // hook runs; failures collect and compose, primary first.
      for (const hook of [...after].reverse()) {
        try {
          await invokeFeatureHook(hook, model.uri);
        } catch (error) {
          failures.push(error as Error);
        }
      }

      if (failures.length > 0) {
        throw composeFailures(failures);
      }
    });
  }
};
