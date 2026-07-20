import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
} from "../__fixtures__/keys.js";
import { FAPI_SIG_ALGS } from "../constants/fapi.js";
import { AegisError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/**
 * The OIDC `id_token_signed_response_alg: HS256` case (Core §10.1): the client
 * secret IS the MAC key. It is per-client and emphatically not a vault resident
 * — the thing aegis could not express before this slice.
 */
const CLIENT_SECRET = KryptosKit.from.utf({
  type: "oct",
  use: "sig",
  algorithm: "HS256",
  privateKey: "a-client-secret-long-enough-for-hs256-hmac",
});

const ID_TOKEN = { subject: "user-1", audience: ["client-1"] };
const ACCESS_TOKEN = {
  subject: "user-1",
  audience: ["https://rs.lindorm.io/"],
  clientId: "client-1",
};

describe("Aegis signing policy", () => {
  let logger: ILogger;
  let amphora: IAmphora;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    await amphora.setup();
  });

  // tyr's two id_token cases, run through the same injected key. Both outcomes
  // are correct, and the difference is the PROFILE's floor — nothing else.
  describe("an injected client secret", () => {
    test("signs an id_token — the profile has no algClass floor", async () => {
      amphora.add(TEST_EC_KEY_SIG);
      const aegis = new Aegis({ amphora, logger });

      const { token } = await aegis.mint("id_token", ID_TOKEN, {
        sign: { key: { kryptos: CLIENT_SECRET } },
      });

      expect(JwtKit.decode(token).header.alg).toBe("HS256");
      expect(JwtKit.decode(token).header.kid).toBe(CLIENT_SECRET.id);
    });

    test("is REJECTED for an access_token — injection is not an escape hatch", async () => {
      amphora.add(TEST_EC_KEY_SIG);
      const aegis = new Aegis({ amphora, logger });

      const error = await aegis
        .mint("access_token", ACCESS_TOKEN, { sign: { key: { kryptos: CLIENT_SECRET } } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("sign_key_policy_violation");
      expect((error as AegisError).data).toMatchObject({
        algClass: "symmetric",
        profile: "access_token",
      });
    });

    test("passes the deployment selector it could never satisfy", async () => {
      // THE CRUX (§0.9). tyr's deployment selector is `{ purpose: "token" }`. A
      // client secret has no purpose at all — so checking an INJECTED key
      // against the SELECTOR would reject the exact case the feature exists
      // for. Only the FLOOR applies to it.
      amphora.add(KryptosKit.clone(TEST_EC_KEY_SIG, { purpose: "token" }));
      const aegis = new Aegis({
        amphora,
        logger,
        sign: { predicate: { purpose: "token" } },
      });

      const { token } = await aegis.mint("id_token", ID_TOKEN, {
        sign: { key: { kryptos: CLIENT_SECRET } },
      });

      expect(JwtKit.decode(token).header.alg).toBe("HS256");
    });
  });

  describe("selector merge", () => {
    test("a per-call algorithm overrides the deployment default (caller wins)", async () => {
      amphora.add(TEST_OKP_KEY_SIG); // EdDSA
      amphora.add(TEST_OCT_KEY_SIG); // HS256

      const aegis = new Aegis({
        amphora,
        logger,
        sign: { predicate: { algorithm: "EdDSA" } },
      });

      const deployment = await aegis.jwt.sign({
        subject: "s",
        expires: "1h",
        tokenType: "N_A",
      });
      expect(JwtKit.decode(deployment.token).header.alg).toBe("EdDSA");

      const perCall = await aegis.jwt.sign(
        { subject: "s", expires: "1h", tokenType: "N_A" },
        { key: { predicate: { algorithm: "HS256" } } },
      );
      expect(JwtKit.decode(perCall.token).header.alg).toBe("HS256");
    });

    test("a per-call predicate pins a key by id", async () => {
      amphora.add(TEST_EC_KEY_SIG);
      amphora.add(TEST_OKP_KEY_SIG);

      const aegis = new Aegis({ amphora, logger });

      const { token } = await aegis.jwt.sign(
        { subject: "s", expires: "1h", tokenType: "N_A" },
        { key: { predicate: { id: TEST_OKP_KEY_SIG.id } } },
      );

      expect(JwtKit.decode(token).header.kid).toBe(TEST_OKP_KEY_SIG.id);
    });

    test("an allowlist selects with $in — the FAPI case", async () => {
      // FAPI is deployment policy, not a key property: aegis publishes the list
      // and the consumer applies it as a selector. HS256 is not on it.
      amphora.add(TEST_OCT_KEY_SIG); // HS256
      amphora.add(TEST_OKP_KEY_SIG); // EdDSA — on the FAPI allowlist

      const aegis = new Aegis({ amphora, logger });

      const { token } = await aegis.jwt.sign(
        { subject: "s", expires: "1h", tokenType: "N_A" },
        { key: { predicate: { algorithm: { $in: FAPI_SIG_ALGS } } } },
      );

      expect(JwtKit.decode(token).header.alg).toBe("EdDSA");
    });

    test("a selector that matches nothing throws, never falls back", async () => {
      amphora.add(TEST_EC_KEY_SIG);
      const aegis = new Aegis({ amphora, logger });

      const error = await aegis.jwt
        .sign(
          { subject: "s", expires: "1h", tokenType: "N_A" },
          { key: { predicate: { purpose: "none" } } },
        )
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("sign_key_not_found");
    });
  });

  // RFC 8725 §3.1: a token must not choose the class of key that verifies it.
  // Selection is driven by the token's own `kid`, so the policy is a CHECK,
  // applied BEFORE the signature is touched.
  describe("verify policy", () => {
    test("rejects a token whose kid names a key the policy forbids", async () => {
      amphora.add(TEST_OCT_KEY_SIG);
      amphora.add(TEST_EC_KEY_SIG);

      const minter = new Aegis({ amphora, logger });
      const { token } = await minter.mint(
        "default",
        { subject: "s", expires: "1h", tokenType: "N_A" },
        { sign: { key: { predicate: { algorithm: "HS256" } } } },
      );

      // The same vault, but a verifier that only accepts asymmetric signatures.
      const verifier = new Aegis({
        amphora,
        logger,
        verify: { predicate: { algClass: "asymmetric" } },
      });

      const error = await verifier.jwt.verify(token).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("verify_key_policy_violation");
      expect((error as AegisError).data).toMatchObject({
        algClass: "symmetric",
        kid: TEST_OCT_KEY_SIG.id,
      });
    });

    test("a per-call verify policy applies too", async () => {
      amphora.add(TEST_OCT_KEY_SIG);

      const aegis = new Aegis({ amphora, logger });
      const { token } = await aegis.mint("default", {
        subject: "s",
        expires: "1h",
        tokenType: "N_A",
      });

      const error = await aegis.jwt
        .verify(token, { key: { predicate: { algClass: "asymmetric" } } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("verify_key_policy_violation");
    });

    test("a conformant token still verifies, and `key` is not read as a claim matcher", async () => {
      // Regression guard: `createJwtVerify` maps every unknown option key to a
      // CLAIM and throws on one it cannot map. `key` must be skipped there,
      // or supplying a key policy would reject every token.
      amphora.add(TEST_EC_KEY_SIG);
      const aegis = new Aegis({ amphora, logger });

      const { token } = await aegis.mint("default", {
        subject: "s",
        expires: "1h",
        tokenType: "N_A",
      });

      const parsed = await aegis.jwt.verify(token, {
        subject: "s",
        key: { predicate: { algClass: "asymmetric" } },
      });

      expect(parsed.payload.sub).toBe("s");
    });
  });
});
