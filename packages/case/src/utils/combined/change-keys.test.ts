import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects.js";
import { CHANGE_CASE_MODES } from "../../types/index.js";
import { changeKeys } from "./change-keys.js";
import { describe, expect, test } from "vitest";

describe.each(CHANGE_CASE_MODES)("changeCase with %s mode", (mode) => {
  test("should convert object", () => {
    expect(changeKeys(TEST_OBJECT, mode)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(changeKeys(TEST_ARRAY_WITH_OBJECTS, mode)).toMatchSnapshot();
  });
});
