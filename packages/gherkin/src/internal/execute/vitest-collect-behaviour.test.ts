// Pins the vitest collection semantics the structural invariant depends on
// (emit-feature.ts): describe factories are DEFERRED to the collect phase,
// and a top-level suite registered last has its factory run AFTER the whole
// preceding subtree — including a SKIPPED suite's factory. If a vitest
// upgrade changes either, the invariant would silently never fire; this file
// makes that upgrade loud.
import { describe, expect, test } from "vitest";

const order: Array<string> = [];

describe("host suite", () => {
  order.push("outer");
  describe("nested suite", () => {
    order.push("nested");
    test("holds a test so the suites are not empty", () => {
      expect(order).toContain("nested");
    });
  });
  order.push("after-nested-call");
});

const atModuleEvaluation = [...order];

describe.skip("trailing skipped probe", () => {
  order.push("trailing-skip");
});

test("vitest defers describe factories past module evaluation", () => {
  expect(atModuleEvaluation).toEqual([]);
});

test("a trailing describe.skip factory runs at collect, after the preceding subtree", () => {
  expect(order).toEqual(["outer", "after-nested-call", "nested", "trailing-skip"]);
});
