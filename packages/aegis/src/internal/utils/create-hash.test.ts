import { Amphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { type IKryptos, type KryptosAlgorithm, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { TEST_AKP_KEY_SIG, TEST_OKP_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { B64U } from "../constants/format.js";
import {
  createAccessTokenHash,
  createCodeHash,
  createStateHash,
  shaAlgorithm,
} from "./create-hash.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

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

  /**
   * The SEAM: which algorithm the mint pipeline hands to the functions above.
   *
   * OIDC Core §3.1.3.6 ties the digest to the token's own signature — the
   * `at_hash` value is "the base64url encoding of the left-most half of the hash
   * of the octets of the ASCII representation of the access_token value, where
   * the hash algorithm used is the hash algorithm used in the alg Header
   * Parameter of the ID Token's JOSE Header". So the size is decided by the KEY
   * the token happened to be signed with, and a pipeline that passed a fixed
   * algorithm would emit a digest a conformant relying party cannot reproduce —
   * while every unit test above kept passing, because the mapping itself would
   * still be correct.
   */
  describe("the signing algorithm sizes the hash a mint derives", () => {
    const ISSUER = "https://test.lindorm.io/";

    const mintIdToken = async (kryptos: IKryptos): Promise<Dict> => {
      const logger = createMockLogger();
      const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
      await amphora.setup();
      amphora.add(kryptos);

      const aegis = new Aegis({ amphora, logger });
      const { token } = await aegis.mint(
        "id_token",
        {
          subject: "user-1",
          audience: ["client-1"],
          accessToken: "the-access-token",
        },
        { context: { accessTokenIssued: false } },
      );

      return JwtKit.decode(token).payload as Dict;
    };

    test.each<[string, IKryptos, number]>([
      // A size-suffixed alg uses that digest: ES256 ⇒ SHA-256 ⇒ 128-bit half.
      ["ES256", KryptosKit.generate.auto({ algorithm: "ES256", publish: true }), 128],
      // A suffix-less alg falls to SHA-512 ⇒ 256-bit half.
      ["EdDSA", TEST_OKP_KEY_SIG, 256],
      ["ML-DSA-65", TEST_AKP_KEY_SIG, 256],
    ])("%s", async (_name, kryptos, bits) => {
      const payload = await mintIdToken(kryptos);

      expect(bitLength(payload.at_hash as string)).toBe(bits);
    });

    // RFC 9964 registers ML-DSA for JOSE, and the domain surface has to carry a
    // post-quantum signature end to end — the wire `alg` string a relying party
    // matches on, and a verify that resolves the key by its `kid` and validates.
    test("a post-quantum signature round-trips through the domain surface", async () => {
      const logger = createMockLogger();
      const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
      await amphora.setup();
      amphora.add(TEST_AKP_KEY_SIG);

      const aegis = new Aegis({ amphora, logger });
      const { token } = await aegis.mint("access_token", {
        subject: "user-1",
        audience: ["https://rs.lindorm.io/"],
        clientId: "client-1",
        scope: ["openid"],
      });

      expect(JwtKit.decode(token).header.alg).toBe("ML-DSA-65");

      await expect(aegis.verify(token)).resolves.toMatchObject({
        claims: { subject: "user-1", clientId: "client-1" },
      });
    });
  });
});
