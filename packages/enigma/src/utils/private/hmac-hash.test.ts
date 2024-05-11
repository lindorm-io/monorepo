import { HmacError } from "../../errors";
import { _assertHmacHash, _createHmacHash, _verifyHmacHash } from "./hmac-hash";

describe("hmac-hash", () => {
  describe("SHA256", () => {
    test("should create hash at base64 digest", () => {
      expect(
        _createHmacHash({
          algorithm: "SHA256",
          data: "data",
          format: "base64",
          secret: "secret",
        }),
      ).toBe("GywWt1vSqHDBFBU8zaW8/KYzFLxyL6Fg1pDeEzzLuds=");
    });

    test("should create hash at hex digest", () => {
      expect(
        _createHmacHash({
          algorithm: "SHA256",
          data: "data",
          format: "hex",
          secret: "secret",
        }),
      ).toBe("1b2c16b75bd2a870c114153ccda5bcfca63314bc722fa160d690de133ccbb9db");
    });
  });

  describe("SHA384", () => {
    test("should create hash at base64 digest", () => {
      expect(
        _createHmacHash({
          algorithm: "SHA384",
          data: "data",
          format: "base64",
          secret: "secret",
        }),
      ).toBe("19FQV7ghz8L58OPo+PwJPF9mHEySFfHQ39327/1Uf9bRWH+oV3pVPMSbDiVzE6xS");
    });

    test("should create hash at hex digest", () => {
      expect(
        _createHmacHash({
          algorithm: "SHA384",
          data: "data",
          format: "hex",
          secret: "secret",
        }),
      ).toBe(
        "d7d15057b821cfc2f9f0e3e8f8fc093c5f661c4c9215f1d0dfddf6effd547fd6d1587fa8577a553cc49b0e257313ac52",
      );
    });
  });

  describe("SHA512", () => {
    test("should create hash at base64 digest", () => {
      expect(
        _createHmacHash({
          algorithm: "SHA512",
          data: "data",
          format: "base64",
          secret: "secret",
        }),
      ).toBe(
        "YnQHHTPewnKKKhyQNpf8EhCzJSIhw9E34S2fGuXI7VPgXmkrBanu//KJZn4jh8D8C9ij2b1wAHgnMMhWp3p31Q==",
      );
    });

    test("should create hash at hex digest", () => {
      expect(
        _createHmacHash({
          algorithm: "SHA512",
          data: "data",
          format: "hex",
          secret: "secret",
        }),
      ).toBe(
        "6274071d33dec2728a2a1c903697fc1210b3252221c3d137e12d9f1ae5c8ed53e05e692b05a9eefff289667e2387c0fc0bd8a3d9bd7000782730c856a77a77d5",
      );
    });
  });

  describe("verify", () => {
    test("should verify hash", () => {
      expect(
        _verifyHmacHash({
          data: "data",
          secret: "secret",
          hash: "GywWt1vSqHDBFBU8zaW8/KYzFLxyL6Fg1pDeEzzLuds=",
        }),
      ).toBe(true);
    });
  });

  describe("assert", () => {
    test("should assert hash", () => {
      expect(() =>
        _assertHmacHash({
          data: "data",
          secret: "secret",
          hash: "GywWt1vSqHDBFBU8zaW8/KYzFLxyL6Fg1pDeEzzLuds=",
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid hash", () => {
      expect(() =>
        _assertHmacHash({
          data: "invalid",
          secret: "secret",
          hash: "GywWt1vSqHDBFBU8zaW8/KYzFLxyL6Fg1pDeEzzLuds=",
        }),
      ).toThrow(HmacError);
    });
  });
});
