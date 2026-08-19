import type { SuiteApi } from "./types.js";

export type CountingSuiteApi = {
  api: SuiteApi;
  /** Test registrations observed so far — read after the suite tree is collected. */
  registered: () => number;
};

/**
 * Counts on the REAL registration path: the wrapper increments exactly where
 * a test is registered, so an emitter bug that drops or doubles a scenario
 * surfaces as a count mismatch (the structural invariant — emit-feature.ts)
 * instead of vanishing from the printed counts.
 */
export const createCountingSuiteApi = (api: SuiteApi): CountingSuiteApi => {
  let count = 0;

  return {
    api: {
      describe: api.describe,
      test: (name, body) => {
        count += 1;
        api.test(name, body);
      },
    },
    registered: () => count,
  };
};
