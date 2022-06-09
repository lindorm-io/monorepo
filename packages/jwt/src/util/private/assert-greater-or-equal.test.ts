import { TokenError } from "../../error";
import { assertGreaterOrEqual } from "./assert-greater-or-equal";

describe("assertGreaterOrEqual", () => {
  test("should resolve", () => {
    expect(() => assertGreaterOrEqual(3, 4, "key")).not.toThrow();
  });

  test("should throw on invalid claim", () => {
    expect(() => assertGreaterOrEqual(3, 1, "key")).toThrow(TokenError);
  });
});
