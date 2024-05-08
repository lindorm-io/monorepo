import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isJwt } from "./is-jwt";

describe("isJwt", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJwt(value)).toMatchSnapshot();
  });
});
