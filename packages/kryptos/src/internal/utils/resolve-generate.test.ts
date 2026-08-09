import { describe, expect, test } from "vitest";
import { resolveGenerate } from "./resolve-generate.js";

describe("resolveGenerate", () => {
  test("should default the content encryption for enc keys", () => {
    expect(
      resolveGenerate({ algorithm: "dir", type: "oct", use: "enc" }),
    ).toMatchSnapshot();
  });

  test("should keep an explicit content encryption", () => {
    expect(
      resolveGenerate({
        algorithm: "dir",
        encryption: "A128CBC-HS256",
        type: "oct",
        use: "enc",
      }),
    ).toMatchSnapshot();
  });

  test("should default an explicit nullish content encryption", () => {
    expect(
      resolveGenerate({ algorithm: "A256KW", encryption: null, type: "oct", use: "enc" }),
    ).toMatchSnapshot();
  });

  test("should null the content encryption for sig keys", () => {
    expect(
      resolveGenerate({ algorithm: "HS512", type: "oct", use: "sig" }),
    ).toMatchSnapshot();
  });

  test("should not carry a content encryption onto a sig key", () => {
    expect(
      resolveGenerate({
        algorithm: "ES256",
        curve: "P-256",
        encryption: "A256GCM",
        type: "EC",
        use: "sig",
      }),
    ).toMatchSnapshot();
  });
});
