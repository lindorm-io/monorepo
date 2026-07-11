import type { MetaGenerated, MetaGeneratedStrategy } from "../types/metadata.js";
import { shouldAutoIncrement } from "./should-auto-increment.js";
import { describe, expect, test } from "vitest";

const makeGenerated = (strategy: MetaGeneratedStrategy | null): MetaGenerated => ({
  key: "id",
  generator: null,
  length: null,
  max: null,
  min: null,
  namespace: null,
  strategy,
});

describe("shouldAutoIncrement", () => {
  test("filters by generation strategy", () => {
    const strategies: Array<MetaGeneratedStrategy | null> = [
      "increment",
      "identity",
      "date",
      "float",
      "integer",
      "lindorm_id",
      "string",
      "uuid",
      null,
    ];

    const result = Object.fromEntries(
      strategies.map((strategy) => [
        String(strategy),
        shouldAutoIncrement(makeGenerated(strategy), undefined),
      ]),
    );

    expect(result).toMatchSnapshot();
  });

  test("treats null, undefined, and 0 as unset", () => {
    const gen = makeGenerated("increment");

    const result = {
      null: shouldAutoIncrement(gen, null),
      undefined: shouldAutoIncrement(gen, undefined),
      zero: shouldAutoIncrement(gen, 0),
    };

    expect(result).toEqual({ null: true, undefined: true, zero: true });
  });

  test("treats a non-zero value as set", () => {
    const gen = makeGenerated("identity");

    const result = {
      one: shouldAutoIncrement(gen, 1),
      negative: shouldAutoIncrement(gen, -5),
      large: shouldAutoIncrement(gen, 99),
    };

    expect(result).toEqual({ one: false, negative: false, large: false });
  });

  test("a set value does not rescue a non-participating strategy", () => {
    expect(shouldAutoIncrement(makeGenerated("uuid"), null)).toBe(false);
  });
});
