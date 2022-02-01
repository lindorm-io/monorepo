import { assertClaimIncludes } from "./assert-claim-includes";
import { TokenError } from "../../error";

describe("assertClaimIncludes", () => {
  test("should resolve", () => {
    expect(() => assertClaimIncludes(["item1"], "item1", "key")).not.toThrow();
  });

  test("should throw on missing claim", () => {
    expect(() => assertClaimIncludes(["item1"], null, "key")).toThrow(TokenError);
  });

  test("should throw on invalid claim", () => {
    expect(() => assertClaimIncludes(["item1"], "wrong", "key")).toThrow(TokenError);
  });
});
