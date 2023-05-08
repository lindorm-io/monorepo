import jwt from "jsonwebtoken";
import { TokenHeaderType } from "../../enum";
import { createOpaqueToken } from "./create-opaque-token";
import { parseTokenHeader } from "./parse-token-header";

describe("parseTokenHeader", () => {
  test("should parse jwt", () => {
    const token = jwt.sign({ payload: "payload" }, "secret");
    expect(parseTokenHeader(token)).toStrictEqual({ alg: "HS256", typ: TokenHeaderType.JWT });
  });

  test("should parse opaque", () => {
    const token = createOpaqueToken(10);
    expect(parseTokenHeader(token)).toStrictEqual({ typ: TokenHeaderType.OPAQUE });
  });
});
