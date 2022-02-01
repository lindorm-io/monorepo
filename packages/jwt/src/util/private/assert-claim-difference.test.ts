import { assertClaimDifference } from "./assert-claim-difference";
import { TokenError } from "../../error";

describe("assertClaimDifference", () => {
  test("should resolve", () => {
    expect(() => assertClaimDifference(["item1"], ["item1", "item2"], "key")).not.toThrow();
  });

  test("should throw on missing claim", () => {
    expect(() => assertClaimDifference(["item1"], [], "key")).toThrow(TokenError);
  });

  test("should throw on invalid claim", () => {
    expect(() => assertClaimDifference(["item1"], ["item2"], "key")).toThrow(TokenError);
  });
});
