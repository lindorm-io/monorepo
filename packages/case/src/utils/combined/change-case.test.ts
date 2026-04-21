import { TEST_STRINGS } from "../../__fixtures__/strings.js";
import type { ChangeCase } from "../../types/index.js";
import { changeCase } from "./change-case.js";
import { describe, expect, test } from "vitest";

describe.each([
  "camel",
  "capital",
  "constant",
  "dot",
  "header",
  "kebab",
  "lower",
  "pascal",
  "path",
  "sentence",
  "snake",
  "none",
] as Array<ChangeCase>)("changeCase with %s mode", (mode) => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(changeCase(input, mode)).toMatchSnapshot();
  });
});
