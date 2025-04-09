import { randomBytes } from "crypto";
import {
  TEST_RSA_KEY_PS256,
  TEST_RSA_KEY_PS384,
  TEST_RSA_KEY_PS512,
  TEST_RSA_KEY_RS256,
  TEST_RSA_KEY_RS384,
  TEST_RSA_KEY_RS512,
} from "../../__fixtures__/keys";
import { RsaError } from "../../errors";
import {
  assertRsaSignature,
  createRsaSignature,
  verifyRsaSignature,
} from "./rsa-signature";

describe("rsa-signature", () => {
  const dsaEncoding = "der";
  const encoding = "base64";

  let data: any;

  beforeEach(() => {
    data = randomBytes(32);
  });

  describe("algorithms", () => {
    test("should sign and verify with RS256", async () => {
      const kryptos = TEST_RSA_KEY_RS256;

      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with RS384", async () => {
      const kryptos = TEST_RSA_KEY_RS384;

      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with RS512", async () => {
      const kryptos = TEST_RSA_KEY_RS512;

      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with PS256", async () => {
      const kryptos = TEST_RSA_KEY_PS256;

      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with PS384", async () => {
      const kryptos = TEST_RSA_KEY_PS384;

      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with PS512", async () => {
      const kryptos = TEST_RSA_KEY_PS512;

      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("encoding", () => {
    const kryptos = TEST_RSA_KEY_RS256;

    test("should sign and verify with no encoding", () => {
      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      }).toString("base64");

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding: "base64",
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with base64 encoding", () => {
      data = randomBytes(32).toString("base64");

      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      }).toString("base64");

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding: "base64",
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with base64url encoding", () => {
      data = randomBytes(32).toString("base64url");

      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      }).toString("base64url");

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding: "base64url",
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with hex encoding", () => {
      data = randomBytes(32).toString("hex");

      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      }).toString("hex");

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding,
          encoding: "hex",
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("dsa", () => {
    const kryptos = TEST_RSA_KEY_RS256;

    test("should sign and verify with der", () => {
      const signature = createRsaSignature({
        data,
        dsaEncoding: "der",
        kryptos,
      });

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding: "der",
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with ieee-p1363", () => {
      const signature = createRsaSignature({
        data,
        dsaEncoding: "ieee-p1363",
        kryptos,
      });

      expect(
        verifyRsaSignature({
          data,
          dsaEncoding: "ieee-p1363",
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_RSA_KEY_RS256;

    test("should assert signature", () => {
      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(() =>
        assertRsaSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createRsaSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(() =>
        assertRsaSignature({
          data: "invalid",
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toThrow(RsaError);
    });
  });
});
