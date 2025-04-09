import { randomBytes } from "crypto";
import {
  TEST_OCT_KEY_HS256,
  TEST_OCT_KEY_HS384,
  TEST_OCT_KEY_HS512,
} from "../../__fixtures__/keys";
import { OctError } from "../../errors";
import {
  assertOctSignature,
  createOctSignature,
  verifyOctSignature,
} from "./oct-signature";

describe("oct-signature", () => {
  const encoding = "base64";

  let data: any;

  beforeEach(() => {
    data = randomBytes(32);
  });

  describe("algorithms", () => {
    test("should sign and verify with HS256", async () => {
      const kryptos = TEST_OCT_KEY_HS256;

      const signature = createOctSignature({
        data,
        kryptos,
      });

      expect(
        verifyOctSignature({
          data,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with HS384", async () => {
      const kryptos = TEST_OCT_KEY_HS384;

      const signature = createOctSignature({
        data,
        kryptos,
      });

      expect(
        verifyOctSignature({
          data,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with HS512", async () => {
      const kryptos = TEST_OCT_KEY_HS512;

      const signature = createOctSignature({
        data,
        kryptos,
      });

      expect(
        verifyOctSignature({
          data,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("encoding", () => {
    const kryptos = TEST_OCT_KEY_HS256;

    test("should sign and verify with no encoding", () => {
      const signature = createOctSignature({
        data,
        kryptos,
      }).toString("base64");

      expect(
        verifyOctSignature({
          data,
          encoding: "base64",
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with base64 encoding", () => {
      data = randomBytes(32).toString("base64");

      const signature = createOctSignature({
        data,
        kryptos,
      }).toString("base64");

      expect(
        verifyOctSignature({
          data,
          encoding: "base64",
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with base64url encoding", () => {
      data = randomBytes(32).toString("base64url");

      const signature = createOctSignature({
        data,
        kryptos,
      }).toString("base64url");

      expect(
        verifyOctSignature({
          data,
          encoding: "base64url",
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with hex encoding", () => {
      data = randomBytes(32).toString("hex");

      const signature = createOctSignature({
        data,
        kryptos,
      }).toString("hex");

      expect(
        verifyOctSignature({
          data,
          encoding: "hex",
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_OCT_KEY_HS256;

    test("should assert signature", () => {
      const signature = createOctSignature({
        data,
        kryptos,
      });

      expect(() =>
        assertOctSignature({
          data,
          encoding,
          kryptos,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createOctSignature({
        data,
        kryptos,
      });

      expect(() =>
        assertOctSignature({
          data: "invalid",
          encoding,
          kryptos,
          signature,
        }),
      ).toThrow(OctError);
    });
  });
});
