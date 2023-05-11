import { CreateOpaqueToken, createOpaqueToken } from "./create-opaque-token";
import { decodeOpaqueToken } from "./decode-opaque-token";

describe("decodeOpaqueToken", () => {
  let token: CreateOpaqueToken;

  beforeEach(() => {
    token = createOpaqueToken({ id: "token-id", header: { foo: "bar" } });
  });

  test("should decode opaque token", () => {
    expect(decodeOpaqueToken(token.token)).toStrictEqual({
      id: "token-id",
      header: {
        foo: "bar",
        oti: "token-id",
        typ: "OPAQUE",
      },
      signature: token.signature,
    });
  });
});
