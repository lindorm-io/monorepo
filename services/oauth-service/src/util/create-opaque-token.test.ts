import { baseParse } from "@lindorm-io/core";
import { createOpaqueToken } from "./create-opaque-token";

describe("createOpaqueToken", () => {
  test("should create opaque token", () => {
    expect(createOpaqueToken()).toStrictEqual(expect.any(String));
  });

  test("should create header for opaque token", () => {
    const token = createOpaqueToken();
    const [header] = token.split(".");

    expect(JSON.parse(baseParse(header))).toStrictEqual({ typ: "OPAQUE" });
  });

  test("should have a predictable payload length", () => {
    const token = createOpaqueToken();
    const [_, payload] = token.split(".");

    expect(payload.length).toEqual(192);
  });
});
