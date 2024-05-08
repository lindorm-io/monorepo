import { TEST_STRINGS } from "../../__fixtures__/strings";
import { ChangeCase } from "../../enums";
import { changeCase } from "./change-case";

describe.each([...Object.values(ChangeCase)])("changeCase with %s mode", (mode) => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(changeCase(input, mode)).toMatchSnapshot();
  });
});
