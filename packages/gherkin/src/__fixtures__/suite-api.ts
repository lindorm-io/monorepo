import type { SuiteApi } from "../internal/execute/types.js";

export type FakeTest = {
  body: () => void | Promise<void>;
  name: string;
  path: Array<string>;
};

export type FakeSuite = {
  mode: "normal" | "skip";
  name: string;
  path: Array<string>;
};

export type FakeLifecycle = {
  fn: () => void | Promise<void>;
  kind: "afterAll" | "beforeAll";
  path: Array<string>;
};

export type FakeSuiteApi = {
  api: SuiteApi;
  lifecycles: Array<FakeLifecycle>;
  suites: Array<FakeSuite>;
  tests: Array<FakeTest>;
};

/**
 * A synchronous stand-in for vitest's describe/test. Factories run
 * immediately in depth-first order — the same final order vitest's deferred
 * collection produces (pinned: vitest-collect-behaviour.test.ts) — and test
 * bodies are captured for the caller to invoke and assert on, because vitest
 * cannot host a deliberately red test in-process.
 */
export const createFakeSuiteApi = (): FakeSuiteApi => {
  const lifecycles: Array<FakeLifecycle> = [];
  const suites: Array<FakeSuite> = [];
  const tests: Array<FakeTest> = [];
  const stack: Array<string> = [];

  const run = (mode: "normal" | "skip", name: string, factory: () => void): void => {
    suites.push({ mode, name, path: [...stack] });
    stack.push(name);
    factory();
    stack.pop();
  };

  const describe = ((name: string, factory: () => void): void =>
    run("normal", name, factory)) as SuiteApi["describe"];

  describe.skip = (name: string, factory: () => void): void => run("skip", name, factory);

  return {
    api: {
      afterAll: (fn) => {
        lifecycles.push({ fn, kind: "afterAll", path: [...stack] });
      },
      beforeAll: (fn) => {
        lifecycles.push({ fn, kind: "beforeAll", path: [...stack] });
      },
      describe,
      test: (name, body) => {
        tests.push({ body, name, path: [...stack] });
      },
    },
    lifecycles,
    suites,
    tests,
  };
};
