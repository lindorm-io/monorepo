import type { Pickle } from "@cucumber/messages";
import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { buildPickleIndex, pickleKey, requirePickle } from "./pickle-index.js";

const pickle = (astNodeIds: Array<string>): Pickle => ({
  astNodeIds,
  id: "9",
  language: "en",
  name: "a scenario",
  steps: [],
  tags: [],
  uri: "test.feature",
});

describe("pickleKey", () => {
  test("should key a plain scenario by its id and an outline row by scenario and row id", () => {
    expect(pickleKey(["3"])).toBe("3");
    expect(pickleKey(["3", "7"])).toBe("3/7");
  });
});

describe("buildPickleIndex", () => {
  test("should index pickles by their astNodeIds", () => {
    const plain = pickle(["3"]);
    const row = pickle(["3", "7"]);

    const index = buildPickleIndex([plain, row]);

    expect(requirePickle(index, "3")).toBe(plain);
    expect(requirePickle(index, "3/7")).toBe(row);
  });
});

describe("requirePickle", () => {
  test("should throw when no pickle was compiled for the key", () => {
    const error = capture(() => requirePickle(buildPickleIndex([]), "3/7"));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
