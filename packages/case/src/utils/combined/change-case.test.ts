import { TEST_STRINGS } from "../../__fixtures__/strings";
import { ChangeCase } from "../../types";
import { changeCase } from "./change-case";

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
