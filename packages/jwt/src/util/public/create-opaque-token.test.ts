import { baseParse } from "@lindorm-io/core";
import { createOpaqueToken } from "./create-opaque-token";

describe("createOpaqueToken", () => {
  test("should create opaque token", () => {
    expect(createOpaqueToken()).toStrictEqual({
      id: expect.any(String),
      roles: [],
      signature: expect.any(String),
      token: expect.any(String),
    });
  });

  test("should contain predictable header", () => {
    const opaqueToken = createOpaqueToken();

    const [header] = opaqueToken.token.split(".");

    expect(JSON.parse(baseParse(header))).toStrictEqual({
      typ: "OPAQUE",
      oti: expect.any(String),
    });
  });

  test("should contain predictable signature", () => {
    const opaqueToken = createOpaqueToken();

    expect(opaqueToken.signature.length).toBe(128);

    const [_, signature] = opaqueToken.token.split(".");

    expect(signature).toBe(opaqueToken.signature);
  });

  test("should contain optional header data", () => {
    const opaqueToken = createOpaqueToken({ header: { foo: "bar" } });
    const [header] = opaqueToken.token.split(".");

    expect(JSON.parse(baseParse(header))).toStrictEqual({
      typ: "OPAQUE",
      oti: expect.any(String),
      foo: "bar",
    });
  });

  test("should contain optional token identifier", () => {
    const opaqueToken = createOpaqueToken({ id: "token-id" });
    const [header] = opaqueToken.token.split(".");

    expect(JSON.parse(baseParse(header))).toStrictEqual({
      typ: "OPAQUE",
      oti: "token-id",
    });
  });

  test("should contain optional roles", () => {
    const opaqueToken = createOpaqueToken({ roles: ["role1"] });

    expect(opaqueToken.roles).toStrictEqual(["role1"]);
  });

  test("should contain optional signature length", () => {
    const opaqueToken = createOpaqueToken({ length: 10 });

    expect(opaqueToken.signature.length).toEqual(10);
  });

  test("should remove optional numbers and symbols", () => {
    const opaqueToken = createOpaqueToken({ numbers: 0, symbols: 0 });

    expect(opaqueToken.signature).toMatch(/^[a-zA-Z]*$/);
  });
});
