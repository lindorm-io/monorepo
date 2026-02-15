import { randomBytes } from "crypto";
import { TEST_OKP_KEY_ED25519, TEST_OKP_KEY_ED448 } from "../../__fixtures__/keys";
import { OkpError } from "../../errors";
import {
  assertOkpSignature,
  createOkpSignature,
  verifyOkpSignature,
} from "./okp-signature";

describe("okp-signature", () => {
  const dsaEncoding = "der";
  const encoding = "base64";

  let data: any;

  beforeEach(() => {
    data = randomBytes(32);
  });

  describe("algorithms", () => {
    test("should sign and verify with Ed25519", async () => {
      const kryptos = TEST_OKP_KEY_ED25519;

      const signature = createOkpSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(
        verifyOkpSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with Ed448", async () => {
      const kryptos = TEST_OKP_KEY_ED448;

      const signature = createOkpSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(
        verifyOkpSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("dsa", () => {
    const kryptos = TEST_OKP_KEY_ED25519;

    test("should sign and verify with der", () => {
      const signature = createOkpSignature({
        data,
        dsaEncoding: "der",
        kryptos,
      });

      expect(
        verifyOkpSignature({
          data,
          dsaEncoding: "der",
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });

    test("should sign and verify with ieee-p1363", () => {
      const signature = createOkpSignature({
        data,
        dsaEncoding: "ieee-p1363",
        kryptos,
      });

      expect(
        verifyOkpSignature({
          data,
          dsaEncoding: "ieee-p1363",
          encoding,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("encoding", () => {
    const kryptos = TEST_OKP_KEY_ED25519;

    test("should sign and verify with no encoding", () => {
      const signature = createOkpSignature({
        data,
        dsaEncoding,
        kryptos,
      }).toString("base64");

      expect(
        verifyOkpSignature({
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

      const signature = createOkpSignature({
        data,
        dsaEncoding,
        kryptos,
      }).toString("base64");

      expect(
        verifyOkpSignature({
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

      const signature = createOkpSignature({
        data,
        dsaEncoding,
        kryptos,
      }).toString("base64url");

      expect(
        verifyOkpSignature({
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

      const signature = createOkpSignature({
        data,
        dsaEncoding,
        kryptos,
      }).toString("hex");

      expect(
        verifyOkpSignature({
          data,
          dsaEncoding,
          encoding: "hex",
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_OKP_KEY_ED25519;

    test("should assert signature", () => {
      const signature = createOkpSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(() =>
        assertOkpSignature({
          data,
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createOkpSignature({
        data,
        dsaEncoding,
        kryptos,
      });

      expect(() =>
        assertOkpSignature({
          data: "invalid",
          dsaEncoding,
          encoding,
          kryptos,
          signature,
        }),
      ).toThrow(OkpError);
    });
  });
});
