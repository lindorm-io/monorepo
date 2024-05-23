import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { TEST_OCT_KEY } from "../../__fixtures__/keys";
import { OctError } from "../../errors";
import {
  assertOctSignature,
  createOctSignature,
  verifyOctSignature,
} from "./oct-signature";

describe("signature", () => {
  const format = "base64";

  let data: string;

  beforeEach(() => {
    data = randomBytes(32).toString("hex");
  });

  describe("algorithms", () => {
    test("should create signature with HS256", () => {
      const kryptos = Kryptos.generate({
        algorithm: "HS256",
        type: "oct",
        use: "sig",
      });

      expect(createOctSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with HS384", () => {
      const kryptos = Kryptos.generate({
        algorithm: "HS384",
        type: "oct",
        use: "sig",
      });

      expect(createOctSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with HS512", () => {
      const kryptos = Kryptos.generate({
        algorithm: "HS512",
        type: "oct",
        use: "sig",
      });

      expect(createOctSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });
  });

  describe("formats", () => {
    test("should create signature at base64 digest", () => {
      expect(
        createOctSignature({
          data,
          format: "base64",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at base64url digest", () => {
      expect(
        createOctSignature({
          data,
          format: "base64url",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        createOctSignature({
          data,
          format: "hex",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    const kryptos = TEST_OCT_KEY;

    test("should verify signature", () => {
      const signature = createOctSignature({ kryptos, data, format });

      expect(
        verifyOctSignature({
          data,
          format,
          kryptos,
          signature,
        }),
      ).toBe(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_OCT_KEY;

    test("should assert signature", () => {
      const signature = createOctSignature({ kryptos, data, format });

      expect(() =>
        assertOctSignature({
          data,
          format,
          kryptos,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createOctSignature({ kryptos, data, format });

      expect(() =>
        assertOctSignature({
          data: "invalid",
          format,
          kryptos,
          signature,
        }),
      ).toThrow(OctError);
    });
  });
});
