import { randomBytes } from "crypto";
import {
  TEST_AKP_KEY_ML_DSA_44,
  TEST_AKP_KEY_ML_DSA_65,
  TEST_AKP_KEY_ML_DSA_87,
} from "../__fixtures__/keys";
import { AkpError } from "../errors";
import {
  assertAkpSignature,
  createAkpSignature,
  verifyAkpSignature,
} from "./akp-signature";

describe("akp-signature", () => {
  const encoding = "base64";

  let data: Buffer;

  beforeEach(() => {
    data = randomBytes(32);
  });

  describe("algorithms", () => {
    test.each([
      { name: "ML-DSA-44", kryptos: TEST_AKP_KEY_ML_DSA_44, sigLen: 2420 },
      { name: "ML-DSA-65", kryptos: TEST_AKP_KEY_ML_DSA_65, sigLen: 3309 },
      { name: "ML-DSA-87", kryptos: TEST_AKP_KEY_ML_DSA_87, sigLen: 4627 },
    ])("should sign and verify with $name", ({ kryptos, sigLen }) => {
      const signature = createAkpSignature({ data, kryptos });

      expect(signature).toHaveLength(sigLen);
      expect(verifyAkpSignature({ data, encoding, kryptos, signature })).toEqual(true);
    });
  });

  describe("encoding", () => {
    const kryptos = TEST_AKP_KEY_ML_DSA_65;

    test("should sign and verify with base64 encoded signature", () => {
      const signature = createAkpSignature({ data, kryptos }).toString("base64");

      expect(
        verifyAkpSignature({ data, encoding: "base64", kryptos, signature }),
      ).toEqual(true);
    });

    test("should sign and verify with base64url encoded signature", () => {
      data = randomBytes(32);
      const signature = createAkpSignature({ data, kryptos }).toString("base64url");

      expect(
        verifyAkpSignature({ data, encoding: "base64url", kryptos, signature }),
      ).toEqual(true);
    });

    test("should sign and verify with hex encoded signature", () => {
      const signature = createAkpSignature({ data, kryptos }).toString("hex");

      expect(verifyAkpSignature({ data, encoding: "hex", kryptos, signature })).toEqual(
        true,
      );
    });

    test("should sign and verify with string data", () => {
      const stringData = randomBytes(32).toString("base64");
      const signature = createAkpSignature({ data: stringData, kryptos });

      expect(
        verifyAkpSignature({ data: stringData, encoding, kryptos, signature }),
      ).toEqual(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_AKP_KEY_ML_DSA_65;

    test("should assert valid signature", () => {
      const signature = createAkpSignature({ data, kryptos });

      expect(() =>
        assertAkpSignature({ data, encoding, kryptos, signature }),
      ).not.toThrow();
    });

    test("should throw on invalid signature", () => {
      const signature = createAkpSignature({ data, kryptos });

      expect(() =>
        assertAkpSignature({ data: "invalid", encoding, kryptos, signature }),
      ).toThrow(AkpError);
    });
  });
});
