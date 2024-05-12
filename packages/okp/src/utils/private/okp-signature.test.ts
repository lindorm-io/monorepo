import { TEST_OKP_KEY } from "../../__fixtures__/keys";
import { OkpError } from "../../errors";
import { _assertOkpSignature, _createOkpSignature, _verifyOkpSignature } from "./okp-signature";

describe("okp-signature", () => {
  test("should create signature at base64 digest", () => {
    expect(
      _createOkpSignature({
        kryptos: TEST_OKP_KEY,
        data: "data",
        format: "base64",
      }),
    ).toStrictEqual(expect.any(String));
  });

  test("should create signature at base64url digest", () => {
    expect(
      _createOkpSignature({
        kryptos: TEST_OKP_KEY,
        data: "data",
        format: "base64url",
      }),
    ).toStrictEqual(expect.any(String));
  });

  test("should create signature at hex digest", () => {
    expect(
      _createOkpSignature({
        kryptos: TEST_OKP_KEY,
        data: "data",
        format: "hex",
      }),
    ).toStrictEqual(expect.any(String));
  });

  test("should verify signature", () => {
    const signature = _createOkpSignature({ kryptos: TEST_OKP_KEY, data: "data" });

    expect(_verifyOkpSignature({ kryptos: TEST_OKP_KEY, data: "data", signature })).toBe(true);
  });

  test("should assert signature", () => {
    const signature = _createOkpSignature({ kryptos: TEST_OKP_KEY, data: "data" });

    expect(() =>
      _assertOkpSignature({ kryptos: TEST_OKP_KEY, data: "data", signature }),
    ).not.toThrow();
  });

  test("should throw error on invalid signature", () => {
    const signature = _createOkpSignature({ kryptos: TEST_OKP_KEY, data: "data" });

    expect(() =>
      _assertOkpSignature({ kryptos: TEST_OKP_KEY, data: "invalid", signature }),
    ).toThrow(OkpError);
  });
});
