import jwt from "jsonwebtoken";
import { TokenHeaderType } from "../../enum";
import { createOpaqueToken } from "./create-opaque-token";
import { getTokenHeaderType } from "./get-token-header-type";

describe("getTokenHeaderType", () => {
  test("should parse jwt", () => {
    const token = jwt.sign({ payload: "payload" }, "secret");

    expect(getTokenHeaderType(token)).toBe(TokenHeaderType.JWT);
  });

  test("should parse opaque", () => {
    const token = createOpaqueToken();

    expect(getTokenHeaderType(token.token)).toBe(TokenHeaderType.OPAQUE);
  });
});
