import type { FeatureModel } from "../model/types.js";

export type SuiteDescribe = {
  (name: string, factory: () => void): void;
  /**
   * An empty SKIPPED suite is legal where an empty plain suite is a vitest
   * collection error — it is how a testless feature file reports `skipped`
   * instead of dying. Pinned: run-feature.vitest.test.ts (real vitest api).
   */
  skip: (name: string, factory: () => void) => void;
};

export type SuiteTestOptions = {
  /**
   * vitest-native tags — the node's inherited Gherkin tags with the `@`
   * stripped and deduplicated (to-vitest-tags.ts). Always present, empty when
   * the node carries none; every name must be declared in the config's
   * `test.tags` or strictTags fails collection — the plugin's config-time
   * scan (scan-tag-declarations.ts) is what keeps that true.
   */
  tags: Array<string>;
};

export type SuiteTest = (
  name: string,
  options: SuiteTestOptions,
  body: () => void | Promise<void>,
) => void;

/**
 * beforeAll/afterAll registration — the mechanism `@BeforeFeature` /
 * `@AfterFeature` compile to (feature-hooks.ts). The returned promise is
 * awaited by vitest, which is what lets a throwing async feature hook fail
 * the suite instead of leaking as an unhandled rejection.
 */
export type SuiteLifecycle = (fn: () => void | Promise<void>) => void;

/**
 * The minimal suite surface the runtime registers into. Defaults to vitest's
 * real `describe`/`test`/`beforeAll`/`afterAll` (suite-api.ts); unit tests
 * inject synchronous fakes so every failure branch can be asserted
 * in-process — vitest cannot host a deliberately red test, which is why the
 * reporter-level proof lives in a child-process meta-test instead.
 */
export type SuiteApi = {
  afterAll: SuiteLifecycle;
  beforeAll: SuiteLifecycle;
  describe: SuiteDescribe;
  test: SuiteTest;
};

export type RunFeatureOptions = {
  api?: SuiteApi;
  model: FeatureModel;
  /**
   * Keyed by module path. Awaiting a thunk imports the step module, which
   * runs its decorators as a side effect — the registration source.
   */
  stepModules: Record<string, () => Promise<unknown>>;
};
