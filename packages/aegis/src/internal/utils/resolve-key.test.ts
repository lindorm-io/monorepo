import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
} from "../../__fixtures__/keys.js";
import { AegisError } from "../../errors/index.js";
import {
  DECRYPT_FLOOR,
  ENCRYPT_FLOOR,
  SIGN_FLOOR,
  VERIFY_FLOOR,
} from "../constants/key-floor.js";
import { resolveKey } from "./resolve-key.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/** A key as amphora ingests it from a remote JWKS: the PUBLIC half only. */
const publicOnly = (kryptos: IKryptos, kid: string): IKryptos =>
  KryptosKit.from.jwk({ ...kryptos.toJWK("public"), kid });

const PUB_SIG = publicOnly(TEST_EC_KEY_SIG, "5c0f2f0e-1f1a-5a2b-8f4c-0d1e2f3a4b5c");
const PUB_ENC = publicOnly(TEST_EC_KEY_ENC, "6d1a3b1f-2a2b-5b3c-9a5d-1e2f3a4b5c6d");

/** A client secret — an OIDC HS256 MAC key. Never a vault resident. */
const CLIENT_SECRET = KryptosKit.from.utf({
  type: "oct",
  use: "sig",
  algorithm: "HS256",
  privateKey: "a-client-secret-long-enough-for-hs256-hmac",
});

describe("resolveKey", () => {
  let logger: ILogger;
  let amphora: IAmphora;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    await amphora.setup();
  });

  // The floors are deliberately ASYMMETRIC. `hasPrivateKey` is what separates
  // the two directions of each pair — and, for ECDH-ES, the ONLY thing that
  // can: its declared operations are identical for both halves.
  describe("the four floors", () => {
    test.each([
      // sign — needs a private half
      { name: "sign accepts a full sig keypair", op: "sign", floor: SIGN_FLOOR, key: TEST_EC_KEY_SIG, ok: true }, // prettier-ignore
      { name: "sign rejects a public-only sig key", op: "sign", floor: SIGN_FLOOR, key: PUB_SIG, ok: false }, // prettier-ignore
      { name: "sign accepts an oct MAC key", op: "sign", floor: SIGN_FLOOR, key: TEST_OCT_KEY_SIG, ok: true }, // prettier-ignore
      { name: "sign rejects an enc key", op: "sign", floor: SIGN_FLOOR, key: TEST_OCT_KEY_ENC, ok: false }, // prettier-ignore

      // verify — a public half is enough, and is the normal case
      { name: "verify accepts a public-only sig key", op: "verify", floor: VERIFY_FLOOR, key: PUB_SIG, ok: true }, // prettier-ignore
      { name: "verify accepts a full sig keypair", op: "verify", floor: VERIFY_FLOOR, key: TEST_EC_KEY_SIG, ok: true }, // prettier-ignore
      { name: "verify rejects an enc key", op: "verify", floor: VERIFY_FLOOR, key: TEST_EC_KEY_ENC, ok: false }, // prettier-ignore

      // encrypt — a public half OR an oct secret. `hasPublicKey` is NOT the
      // floor: an oct key has none, and requiring one would break `dir`/`A*KW`
      // encryption outright.
      { name: "encrypt accepts a public-only recipient key", op: "encrypt", floor: ENCRYPT_FLOOR, key: PUB_ENC, ok: true }, // prettier-ignore
      { name: "encrypt accepts an oct dir key (no public half)", op: "encrypt", floor: ENCRYPT_FLOOR, key: TEST_OCT_KEY_ENC, ok: true }, // prettier-ignore
      { name: "encrypt rejects a sig key", op: "encrypt", floor: ENCRYPT_FLOOR, key: TEST_EC_KEY_SIG, ok: false }, // prettier-ignore

      // decrypt — needs a private half
      { name: "decrypt rejects a public-only ECDH key", op: "decrypt", floor: DECRYPT_FLOOR, key: PUB_ENC, ok: false }, // prettier-ignore
      { name: "decrypt accepts a full ECDH keypair", op: "decrypt", floor: DECRYPT_FLOOR, key: TEST_EC_KEY_ENC, ok: true }, // prettier-ignore
      { name: "decrypt accepts an oct dir key", op: "decrypt", floor: DECRYPT_FLOOR, key: TEST_OCT_KEY_ENC, ok: true }, // prettier-ignore
    ] as const)("$name", async ({ op, floor, key, ok }) => {
      amphora.add(key);

      const result = await resolveKey({
        amphora,
        floor,
        logger,
        operation: op,
      }).catch((err: Error) => err);

      if (ok) {
        expect(result).toBe(key);
      } else {
        expect(result).toBeInstanceOf(AegisError);
        expect((result as AegisError).code).toBe(`${op}_key_not_found`);
      }
    });
  });

  describe("floor vs selector", () => {
    test("an injected key is checked against the FLOOR", async () => {
      // Injection is not an escape hatch: an HS256 client secret cannot sign an
      // artifact whose profile mandates an asymmetric signature.
      const error = await resolveKey({
        amphora,
        floor: { ...SIGN_FLOOR, algClass: "asymmetric" },
        kryptos: CLIENT_SECRET,
        logger,
        operation: "sign",
        profile: "access_token",
      }).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("sign_key_policy_violation");
      expect((error as AegisError).data).toMatchObject({
        algClass: "symmetric",
        algorithm: "HS256",
        profile: "access_token",
      });
    });

    test("an injected key is NOT checked against the SELECTOR", async () => {
      // The crux (§0.9). A client secret has no `purpose: "token"` and never
      // came from the vault, so checking it against a vault QUERY would reject
      // the very case key injection exists for.
      const kryptos = await resolveKey({
        amphora,
        floor: SIGN_FLOOR,
        selector: { purpose: "token" },
        kryptos: CLIENT_SECRET,
        logger,
        operation: "sign",
        profile: "id_token",
      });

      expect(kryptos).toBe(CLIENT_SECRET);
      expect(kryptos.purpose).toBeNull(); // it could never satisfy `purpose: "token"`
    });

    test("the selector picks among vault keys", async () => {
      amphora.add(TEST_OKP_KEY_SIG); // EdDSA
      amphora.add(TEST_OCT_KEY_SIG); // HS256

      const kryptos = await resolveKey({
        amphora,
        floor: SIGN_FLOOR,
        selector: { algorithm: "EdDSA" },
        logger,
        operation: "sign",
      });

      expect(kryptos).toBe(TEST_OKP_KEY_SIG);
    });

    test("a selector that contradicts the floor still cannot produce a forbidden key", async () => {
      // The selector may name `algClass` — but the FLOOR is checked on the
      // result, so the worst a caller can do is provoke a clean throw.
      amphora.add(TEST_OCT_KEY_SIG);
      amphora.add(TEST_EC_KEY_SIG);

      const error = await resolveKey({
        amphora,
        floor: { ...SIGN_FLOOR, algClass: "asymmetric" },
        selector: { algClass: "symmetric" },
        logger,
        operation: "sign",
        profile: "access_token",
      }).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("sign_key_policy_violation");
      expect((error as AegisError).data).toMatchObject({ algorithm: "HS256" });
    });
  });

  describe("the read side resolves by id", () => {
    test("findById ignores the selector — an expired or unpublished key must still verify", async () => {
      amphora.add(TEST_OCT_KEY_SIG);

      const kryptos = await resolveKey({
        amphora,
        floor: VERIFY_FLOOR,
        selector: { algorithm: "EdDSA" }, // would exclude the HS key as a query
        id: TEST_OCT_KEY_SIG.id,
        logger,
        operation: "verify",
      });

      expect(kryptos.id).toBe(TEST_OCT_KEY_SIG.id);
    });

    test("but the FLOOR still applies to the key a token names", async () => {
      amphora.add(PUB_ENC);

      const error = await resolveKey({
        amphora,
        floor: DECRYPT_FLOOR,
        id: PUB_ENC.id,
        logger,
        operation: "decrypt",
      }).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_policy_violation");
    });
  });

  test("a policy miss names the policy and the profile, not a bare not-found", async () => {
    amphora.add(TEST_OCT_KEY_SIG);

    const error = await resolveKey({
      amphora,
      floor: { ...SIGN_FLOOR, algClass: "asymmetric" },
      selector: { purpose: "token" },
      logger,
      operation: "sign",
      profile: "access_token",
    }).catch((err: Error) => err);

    expect(error).toBeInstanceOf(AegisError);
    expect((error as AegisError).code).toBe("sign_key_not_found");
    expect((error as AegisError).data).toEqual({
      policy: {
        use: "sig",
        hasPrivateKey: true,
        isActive: true,
        algClass: "asymmetric",
        purpose: "token",
      },
      profile: "access_token",
    });
  });

  // The vault filters `isActive` on a QUERY, so the clock only bites where the
  // vault does not: a key handed in outright, and a key named by an artifact's
  // own `kid`. Both are the paths a caller controls.
  describe("the time floor", () => {
    const detached = (notBefore: Date, expiresAt: Date): IKryptos =>
      KryptosKit.clone(TEST_EC_KEY_SIG, {
        id: "6b1f0c9e-0000-4000-8000-00000000000a",
        notBefore,
        expiresAt,
      });

    const resolveSign = (kryptos: IKryptos) =>
      resolveKey({
        amphora,
        floor: SIGN_FLOOR,
        selector: {},
        logger,
        operation: "sign",
        kryptos,
      }).catch((err: Error) => err);

    test("refuses to SIGN with an injected key that has expired", async () => {
      const expired = detached(new Date("2020-01-01"), new Date("2021-01-01"));

      const error = await resolveSign(expired);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("sign_key_policy_violation");
    });

    test("refuses to SIGN with an injected key that is not yet valid", async () => {
      const pending = detached(new Date("2099-01-01"), new Date("2100-01-01"));

      const error = await resolveSign(pending);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("sign_key_policy_violation");
    });

    test("still VERIFIES with a key that has since expired", async () => {
      // The point of an `expiresAt` rather than a deletion: a token signed while
      // the key was valid must keep verifying after the key rotates out.
      const expired = detached(new Date("2020-01-01"), new Date("2021-01-01"));

      const kryptos = await resolveKey({
        amphora,
        floor: VERIFY_FLOOR,
        selector: {},
        logger,
        operation: "verify",
        kryptos: expired,
      });

      expect(kryptos.id).toBe(expired.id);
    });

    test("refuses to VERIFY against a key that is not yet valid", async () => {
      // A client can name any `kid` in the vault. A key whose `notBefore` has not
      // passed cannot have signed anything, ever — so nothing it names is real.
      const pending = detached(new Date("2099-01-01"), new Date("2100-01-01"));

      const error = await resolveKey({
        amphora,
        floor: VERIFY_FLOOR,
        selector: {},
        logger,
        operation: "verify",
        kryptos: pending,
      }).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("verify_key_policy_violation");
    });
  });
});
