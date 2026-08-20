import type { Pickle } from "@cucumber/messages";
import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { assertPickleParity } from "./assert-pickle-parity.js";

// The public path (buildFeatureModel) can never produce an orphan — the walk
// and compile() read the same document — so the throw is reached by handing
// the internal function a deliberately inconsistent index.
const pickle = (astNodeIds: Array<string>): Pickle =>
  ({ astNodeIds }) as unknown as Pickle;

describe("assertPickleParity", () => {
  test("should stay silent for an empty index", () => {
    expect(() =>
      assertPickleParity({
        consumedPickleKeys: new Set(),
        excludedPickleKeys: new Set(),
        pickleIndex: new Map(),
        supersededScenarioIds: new Set(),
        uri: "src/features/test.feature",
      }),
    ).not.toThrow();
  });

  test("should stay silent when every pickle is consumed", () => {
    expect(() =>
      assertPickleParity({
        consumedPickleKeys: new Set(["s1", "s2/r1"]),
        excludedPickleKeys: new Set(),
        pickleIndex: new Map([
          ["s1", pickle(["s1"])],
          ["s2/r1", pickle(["s2", "r1"])],
        ]),
        supersededScenarioIds: new Set(),
        uri: "src/features/test.feature",
      }),
    ).not.toThrow();
  });

  test("should stay silent when an unconsumed pickle is superseded by its scenario's failing node", () => {
    expect(() =>
      assertPickleParity({
        consumedPickleKeys: new Set(),
        excludedPickleKeys: new Set(),
        pickleIndex: new Map([
          // A zero-step outline: one superseding empty-scenario node stands
          // in for every row pickle of scenario s1.
          ["s1/r1", pickle(["s1", "r1"])],
          ["s1/r2", pickle(["s1", "r2"])],
        ]),
        supersededScenarioIds: new Set(["s1"]),
        uri: "src/features/test.feature",
      }),
    ).not.toThrow();
  });

  test("should stay silent when an unconsumed pickle was excluded by the tags expression", () => {
    expect(() =>
      assertPickleParity({
        consumedPickleKeys: new Set(["s1"]),
        excludedPickleKeys: new Set(["s2"]),
        pickleIndex: new Map([
          ["s1", pickle(["s1"])],
          ["s2", pickle(["s2"])],
        ]),
        supersededScenarioIds: new Set(),
        uri: "src/features/test.feature",
      }),
    ).not.toThrow();
  });

  test("should throw model_invariant for an orphaned pickle", () => {
    const error = capture(() =>
      assertPickleParity({
        consumedPickleKeys: new Set(["s1"]),
        excludedPickleKeys: new Set(),
        pickleIndex: new Map([
          ["s1", pickle(["s1"])],
          ["s2", pickle(["s2"])],
        ]),
        supersededScenarioIds: new Set(),
        uri: "src/features/test.feature",
      }),
    );

    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should list only the orphans when consumed, superseded, excluded and orphaned pickles coexist", () => {
    const error = capture(() =>
      assertPickleParity({
        consumedPickleKeys: new Set(["s1"]),
        excludedPickleKeys: new Set(["s5"]),
        pickleIndex: new Map([
          ["s1", pickle(["s1"])],
          ["s2/r1", pickle(["s2", "r1"])],
          ["s3", pickle(["s3"])],
          ["s4/r9", pickle(["s4", "r9"])],
          ["s5", pickle(["s5"])],
        ]),
        supersededScenarioIds: new Set(["s2"]),
        uri: "src/features/test.feature",
      }),
    );

    expect(error.data.orphans).toEqual(["s3", "s4/r9"]);
  });
});
