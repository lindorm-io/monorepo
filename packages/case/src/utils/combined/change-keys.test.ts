import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects";
import { ChangeCase } from "../../types";
import { changeKeys } from "./change-keys";

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
  test("should convert object", () => {
    expect(changeKeys(TEST_OBJECT, mode)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(changeKeys(TEST_ARRAY_WITH_OBJECTS, mode)).toMatchSnapshot();
  });
});
