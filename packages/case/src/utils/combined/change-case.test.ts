import { TEST_STRINGS } from "../../__fixtures__/strings.js";
import { CHANGE_CASE_MODES } from "../../types/index.js";
import { changeCase } from "./change-case.js";
import { describe, expect, test } from "vitest";

describe.each(CHANGE_CASE_MODES)("changeCase with %s mode", (mode) => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(changeCase(input, mode)).toMatchSnapshot();
  });
});
