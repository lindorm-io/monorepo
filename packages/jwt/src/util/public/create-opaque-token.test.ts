import { baseParse } from "@lindorm-io/core";
import { createOpaqueToken } from "./create-opaque-token";

describe("createOpaqueToken", () => {
  test("should create opaque token", () => {
    expect(createOpaqueToken()).toStrictEqual(expect.any(String));
  });

  test("should create header for opaque token", () => {
    const token = createOpaqueToken(12, { foo: "bar" });
    const [header] = token.split(".");

    expect(JSON.parse(baseParse(header))).toStrictEqual({ typ: "OPAQUE", foo: "bar" });
  });

  test("should have a predictable signature length", () => {
    const token = createOpaqueToken(10);
    const [_, signature] = token.split(".");

    expect(signature.length).toEqual(10);
  });

  test("should have a default signature length", () => {
    const token = createOpaqueToken();
    const [_, signature] = token.split(".");

    expect(signature.length).toEqual(192);
  });
});
