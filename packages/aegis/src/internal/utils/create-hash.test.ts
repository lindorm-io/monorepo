import { B64 } from "@lindorm/b64";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { B64U } from "../constants/format.js";
import {
  createAccessTokenHash,
  createCodeHash,
  createStateHash,
  shaAlgorithm,
} from "./create-hash.js";
import { describe, expect, test } from "vitest";

const bitLength = (hash: string): number => B64.toBuffer(hash, B64U).length * 8;

describe("create-hash", () => {
  describe("shaAlgorithm", () => {
    test.each<[KryptosAlgorithm, string]>([
      ["RS256", "SHA256"],
      ["ES256", "SHA256"],
      ["PS256", "SHA256"],
      ["HS256", "SHA256"],
      ["ES384", "SHA384"],
      ["RS384", "SHA384"],
      ["ES512", "SHA512"],
      ["RS512", "SHA512"],
      ["HS512", "SHA512"],
    ])("should map suffixed alg %s to %s", (algorithm, expected) => {
      expect(shaAlgorithm(algorithm)).toBe(expected);
    });

    test.each<KryptosAlgorithm>(["EdDSA", "ML-DSA-44", "ML-DSA-65", "ML-DSA-87"])(
      "should map suffix-less alg %s to SHA512",
      (algorithm) => {
        expect(shaAlgorithm(algorithm)).toBe("SHA512");
      },
    );
  });

  describe("truncation is the left-most half of the chosen digest", () => {
    const data = "some-token-value";

    test("SHA256-based alg yields 128-bit hashes for all three claims", () => {
      expect(bitLength(createAccessTokenHash("RS256", data))).toBe(128);
      expect(bitLength(createCodeHash("RS256", data))).toBe(128);
      expect(bitLength(createStateHash("RS256", data))).toBe(128);
    });

    test("SHA384-based alg yields 192-bit hashes for all three claims", () => {
      expect(bitLength(createAccessTokenHash("ES384", data))).toBe(192);
      expect(bitLength(createCodeHash("ES384", data))).toBe(192);
      expect(bitLength(createStateHash("ES384", data))).toBe(192);
    });

    test("SHA512-based alg yields 256-bit hashes for all three claims", () => {
      expect(bitLength(createAccessTokenHash("ES512", data))).toBe(256);
      expect(bitLength(createCodeHash("ES512", data))).toBe(256);
      expect(bitLength(createStateHash("ES512", data))).toBe(256);
    });

    test("EdDSA (suffix-less) yields SHA512-based 256-bit hashes", () => {
      expect(bitLength(createAccessTokenHash("EdDSA", data))).toBe(256);
      expect(bitLength(createCodeHash("EdDSA", data))).toBe(256);
      expect(bitLength(createStateHash("EdDSA", data))).toBe(256);
    });

    test("ML-DSA-65 (suffix-less) yields SHA512-based 256-bit hashes", () => {
      expect(bitLength(createAccessTokenHash("ML-DSA-65", data))).toBe(256);
      expect(bitLength(createCodeHash("ML-DSA-65", data))).toBe(256);
      expect(bitLength(createStateHash("ML-DSA-65", data))).toBe(256);
    });

    test("c_hash on an RS256 token emits the 128-bit half, not the full 256-bit digest", () => {
      const hash = createCodeHash("RS256", data);

      expect(bitLength(hash)).toBe(128);
      expect(bitLength(hash)).not.toBe(256);
    });
  });

  describe("hash values", () => {
    const accessToken = "access-token";
    const authCode = "auth-code";
    const authState = "auth-state";

    test("EdDSA produces stable SHA512-half hashes", () => {
      expect({
        at_hash: createAccessTokenHash("EdDSA", accessToken),
        c_hash: createCodeHash("EdDSA", authCode),
        s_hash: createStateHash("EdDSA", authState),
      }).toMatchSnapshot();
    });

    test("ML-DSA-65 produces stable SHA512-half hashes", () => {
      expect({
        at_hash: createAccessTokenHash("ML-DSA-65", accessToken),
        c_hash: createCodeHash("ML-DSA-65", authCode),
        s_hash: createStateHash("ML-DSA-65", authState),
      }).toMatchSnapshot();
    });

    test("RS256 produces stable SHA256-half hashes", () => {
      expect({
        at_hash: createAccessTokenHash("RS256", accessToken),
        c_hash: createCodeHash("RS256", authCode),
        s_hash: createStateHash("RS256", authState),
      }).toMatchSnapshot();
    });

    test("EdDSA and ML-DSA-65 hashes match (both SHA512) for the same input", () => {
      expect(createCodeHash("EdDSA", authCode)).toBe(
        createCodeHash("ML-DSA-65", authCode),
      );
    });
  });
});
