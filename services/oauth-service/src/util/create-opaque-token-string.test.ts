import { createOpaqueTokenString } from "./create-opaque-token-string";
import { baseParse } from "@lindorm-io/core";

describe("createOpaqueTokenString", () => {
  test("should create opaque token", () => {
    expect(createOpaqueTokenString()).toStrictEqual(expect.any(String));
  });

  test("should have a predictable structure", () => {
    const token = createOpaqueTokenString();
    const [header, payload, signature] = token.split(".");

    expect(header.length).toEqual(22);
    expect(payload.length).toEqual(128);
    expect(signature.length).toEqual(32);
  });

  test("should have a predictable length", () => {
    expect(createOpaqueTokenString().length).toEqual(184);
  });

  test("should create header for opaque token", () => {
    const token = createOpaqueTokenString();
    const [header] = token.split(".");

    expect(JSON.parse(baseParse(header))).toStrictEqual({ typ: "OPAQUE" });
  });
});
