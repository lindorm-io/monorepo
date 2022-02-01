import { assertClaimEquals } from "./assert-claim-equals";
import { TokenError } from "../../error";

describe("assertClaimEquals", () => {
  test("should resolve", () => {
    expect(() => assertClaimEquals("item1", "item1", "key")).not.toThrow();
  });

  test("should throw on missing claim", () => {
    expect(() => assertClaimEquals("item1", null, "key")).toThrow(TokenError);
  });

  test("should throw on invalid claim", () => {
    expect(() => assertClaimEquals("item1", "wrong", "key")).toThrow(TokenError);
  });
});
