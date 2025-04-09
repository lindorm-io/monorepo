import { randomBytes } from "crypto";
import {
  TEST_EC_KEY_ES256,
  TEST_EC_KEY_ES384,
  TEST_EC_KEY_ES512,
} from "../../__fixtures__/keys";
import { EcError } from "../../errors";
import { assertEcSignature, createEcSignature, verifyEcSignature } from "./ec-signature";

describe("ec-signature", () => {
  const dsaEncoding = "der";
  const encoding = "base64";

  let data: any;
  let raw: boolean;

  beforeEach(() => {
    data = randomBytes(32);
    raw = false;
  });

  describe("algorithms", () => {
    test("should sign and verify with ES256", async () => {
      const kryptos = TEST_EC_KEY_ES256;

      const signature = createEcSignature({
        data,
        dsaEncoding,
        kryptos,
        raw,
      });

      expect(
        verifyEcSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          raw,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with ES384", async () => {
      const kryptos = TEST_EC_KEY_ES384;

      const signature = createEcSignature({
        data,
        dsaEncoding,
        kryptos,
        raw,
      });

      expect(
        verifyEcSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          raw,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with ES512", async () => {
      const kryptos = TEST_EC_KEY_ES512;

      const signature = createEcSignature({
        data,
        dsaEncoding,
        kryptos,
        raw,
      });

      expect(
        verifyEcSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          raw,
          signature,
        }),
      ).toEqual(true);
    });

    describe("raw", () => {
      test("should sign and verify with P-256 raw formatting", async () => {
        const kryptos = TEST_EC_KEY_ES256;

        raw = true;

        const signature = createEcSignature({
          data,
          dsaEncoding,
          kryptos,
          raw,
        });

        expect(
          verifyEcSignature({
            data,
            dsaEncoding,
            encoding,
            kryptos,
            raw,
            signature,
          }),
        ).toEqual(true);
      });

      test("should sign and verify with P-384 raw formatting", async () => {
        const kryptos = TEST_EC_KEY_ES384;

        raw = true;

        const signature = createEcSignature({
          data,
          dsaEncoding,
          kryptos,
          raw,
        });

        expect(
          verifyEcSignature({
            data,
            dsaEncoding,
            encoding,
            kryptos,
            raw,
            signature,
          }),
        ).toEqual(true);
      });

      test("should sign and verify with P-521 raw formatting", async () => {
        const kryptos = TEST_EC_KEY_ES512;

        raw = true;

        const signature = createEcSignature({
          data,
          dsaEncoding,
          kryptos,
          raw,
        });

        expect(
          verifyEcSignature({
            data,
            dsaEncoding,
            encoding,
            kryptos,
            raw,
            signature,
          }),
        ).toEqual(true);
      });
    });
  });

  describe("dsa", () => {
    const kryptos = TEST_EC_KEY_ES256;

    test("should sign and verify with der", () => {
      const signature = createEcSignature({
        data,
        dsaEncoding: "der",
        kryptos,
        raw,
      });

      expect(
        verifyEcSignature({
          data,
          dsaEncoding: "der",
          encoding,
          kryptos,
          raw,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with ieee-p1363", () => {
      const signature = createEcSignature({
        data,
        dsaEncoding: "ieee-p1363",
        kryptos,
        raw,
      });

      expect(
        verifyEcSignature({
          data,
          dsaEncoding: "ieee-p1363",
          encoding,
          kryptos,
          raw,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("encoding", () => {
    const kryptos = TEST_EC_KEY_ES256;

    test("should sign and verify with no encoding", () => {
      const signature = createEcSignature({
        data,
        dsaEncoding,
        kryptos,
        raw,
      });

      expect(
        verifyEcSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          raw,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with base64 encoding", () => {
      data = randomBytes(32).toString("base64");

      const signature = createEcSignature({
        data,
        dsaEncoding,
        kryptos,
        raw,
      }).toString("base64");

      expect(
        verifyEcSignature({
          data,
          dsaEncoding,
          encoding: "base64",
          kryptos,
          raw,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with base64url encoding", () => {
      data = randomBytes(32).toString("base64url");

      const signature = createEcSignature({
        data,
        dsaEncoding,
        kryptos,
        raw,
      }).toString("base64url");

      expect(
        verifyEcSignature({
          data,
          dsaEncoding,
          encoding: "base64url",
          kryptos,
          raw,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with hex encoding", () => {
      data = randomBytes(32).toString("hex");

      const signature = createEcSignature({
        data,
        dsaEncoding,
        kryptos,
        raw,
      }).toString("hex");

      expect(
        verifyEcSignature({
          data,
          dsaEncoding,
          encoding: "hex",
          kryptos,
          raw,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_EC_KEY_ES256;

    test("should assert signature", () => {
      const signature = createEcSignature({
        data,
        dsaEncoding,
        kryptos,
        raw,
      });

      expect(() =>
        assertEcSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          raw,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createEcSignature({
        data,
        dsaEncoding,
        kryptos,
        raw,
      });

      expect(() =>
        assertEcSignature({
          data: "invalid",
          dsaEncoding,
          encoding,
          kryptos,
          raw,
          signature,
        }),
      ).toThrow(EcError);
    });
  });
});
