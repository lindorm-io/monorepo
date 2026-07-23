import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_ENC, TEST_OCT_KEY_SIG } from "../__fixtures__/keys.js";
import { AegisError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const PLAINTEXT = "cookie-session-payload";

/**
 * The pylon shape: ONE Aegis for the whole deployment, and enc keys with
 * different jobs. Without a per-call selector the AES path could only ask the
 * deployment-wide enc policy — which hands back the newest published token key,
 * so a cookie got sealed with the key it publishes to the world while the
 * internal `dir` key that exists for exactly that job went unused.
 */

// ⚠ `KryptosKit.clone` cannot change a key's `id` (it spreads `export("der")`,
// which carries the id, over the overwrite), so the cookie keys are built as
// their own `dir` keys rather than cloned from the fixture.
const octEnc = (id: string, privateKey: string) => ({
  id,
  privateKey,
  algorithm: "dir" as const,
  expiresAt: new Date("2024-06-01T00:00:00.000Z"),
  notBefore: new Date("2023-01-01T01:00:00.000Z"),
  publicKey: "",
  type: "oct" as const,
  use: "enc" as const,
});

// The published token enc key. NEWEST, so amphora's newest-first sort hands it
// to every enc query that does not say otherwise.
const TOKEN_KEY = KryptosKit.clone(TEST_EC_KEY_ENC, {
  purpose: "token",
  publish: true,
  createdAt: new Date("2023-12-01T00:00:00.000Z"),
});

// A published cookie key, OLDER than the token key. The `{ purpose: "cookie" }`
// selector must beat the sort.
const COOKIE_KEY = KryptosKit.from.b64({
  ...octEnc(
    "f1a2b3c4-0002-5aaa-9bbb-0123456789ab",
    "u5Z2h3wSNEGF6Z8vjEN71q-JowHMZ8IVC7v8aCZCB_Q",
  ),
  purpose: "cookie",
  publish: true,
  createdAt: new Date("2023-06-01T00:00:00.000Z"),
});

// The cookie key as a pylon actually holds it: internal, and NOT in the JWKS.
// `publish: false` hides a key from SELECTION, not just from publication, so a
// consumer reaching for it must say so — amphora's queries start from the
// published set. That opt-in is the selector's job, and it is why `publish`
// stays a caller attribute rather than part of aegis's floor.
const INTERNAL_COOKIE_KEY = KryptosKit.from.b64({
  ...octEnc(
    "f1a2b3c4-0003-5aaa-9bbb-0123456789ab",
    "mtw71kr9yojcS2RCAW5g0xfhXuwFEekY6KakBw3srwA",
  ),
  purpose: "cookie",
  internal: true,
  publish: false,
  createdAt: new Date("2023-06-01T00:00:00.000Z"),
});

// A key the vault never held. Encrypting with it and being unable to decrypt
// again is the failure mode the decrypt-side selector exists to prevent.
const DETACHED_KEY = KryptosKit.from.b64({
  ...octEnc(
    "f1a2b3c4-0004-5aaa-9bbb-0123456789ab",
    "PGfkV3lCX92QGq3cCbt8E01GkOyub6bQbfuWyktr2pY",
  ),
  purpose: "detached",
});

// Same, but a signing key — an injected key is floor-checked like any other.
const DETACHED_SIG_KEY = KryptosKit.clone(TEST_OCT_KEY_SIG, {
  purpose: "detached",
});

describe("Aegis AES key selection", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TOKEN_KEY);
    amphora.add(COOKIE_KEY);
    amphora.add(INTERNAL_COOKIE_KEY);
  });

  // The pre-existing surface: `aes.encrypt(data)` / `aes.decrypt(data)` with no
  // key argument must keep resolving from the deployment policy alone.
  describe("no selector (regression)", () => {
    test("encrypts with the newest published enc key", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT);

      expect(AesKit.parse(encoded).keyId).toBe(TOKEN_KEY.id);
    });

    test("round-trips every mode", async () => {
      const cbor = await aegis.aes.encrypt(PLAINTEXT);
      const record = await aegis.aes.encrypt(PLAINTEXT, "record");
      const serialised = await aegis.aes.encrypt(PLAINTEXT, "serialised");

      await expect(aegis.aes.decrypt(cbor)).resolves.toBe(PLAINTEXT);
      await expect(aegis.aes.decrypt(record)).resolves.toBe(PLAINTEXT);
      await expect(aegis.aes.decrypt(serialised)).resolves.toBe(PLAINTEXT);
    });

    test("forwards ECDH-ES apu/apv onto the header and round-trips every mode", async () => {
      const apu = Buffer.from("Alice");
      const apv = Buffer.from("Bob");

      const cbor = await aegis.aes.encrypt(PLAINTEXT, "cbor", { apu, apv });
      const serialised = await aegis.aes.encrypt(PLAINTEXT, "serialised", { apu, apv });

      expect(AesKit.parse(cbor).apu).toEqual(apu);
      expect(AesKit.parse(cbor).apv).toEqual(apv);
      expect(AesKit.parse(serialised).apu).toEqual(apu);
      expect(AesKit.parse(serialised).apv).toEqual(apv);

      await expect(aegis.aes.decrypt(cbor)).resolves.toBe(PLAINTEXT);
      await expect(aegis.aes.decrypt(serialised)).resolves.toBe(PLAINTEXT);
    });

    test("honours the deployment encrypt policy", async () => {
      const deployment = new Aegis({
        amphora,
        logger,
        encrypt: { predicate: { purpose: "cookie" } },
      });

      const encoded = await deployment.aes.encrypt(PLAINTEXT);

      expect(AesKit.parse(encoded).keyId).toBe(COOKIE_KEY.id);
    });
  });

  describe("per-call selector", () => {
    test("selects the cookie key over a NEWER published enc key", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { predicate: { purpose: "cookie" } },
      });

      expect(AesKit.parse(encoded).keyId).toBe(COOKIE_KEY.id);
      expect(AesKit.parse(encoded).keyId).not.toBe(TOKEN_KEY.id);
    });

    test("reaches the INTERNAL, unpublished cookie key — the pylon case", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { predicate: { purpose: "cookie", publish: false } },
      });

      expect(AesKit.parse(encoded).keyId).toBe(INTERNAL_COOKIE_KEY.id);

      // `findById` is unfiltered, so an unpublished key still decrypts what it
      // sealed — the read side needs no selector to reach it.
      await expect(aegis.aes.decrypt(encoded)).resolves.toBe(PLAINTEXT);
    });

    test("overrides the deployment-level encrypt policy — the caller wins", async () => {
      const deployment = new Aegis({
        amphora,
        logger,
        encrypt: { predicate: { purpose: "token" } },
      });

      const byDeployment = await deployment.aes.encrypt(PLAINTEXT);
      const byCall = await deployment.aes.encrypt(PLAINTEXT, "cbor", {
        key: { predicate: { purpose: "cookie" } },
      });

      expect(AesKit.parse(byDeployment).keyId).toBe(TOKEN_KEY.id);
      expect(AesKit.parse(byCall).keyId).toBe(COOKIE_KEY.id);
    });

    test("the merge is SHALLOW — an unmentioned deployment key survives", async () => {
      const deployment = new Aegis({
        amphora,
        logger,
        encrypt: { predicate: { purpose: "cookie", publish: false } },
      });

      // The caller names the algorithm; `purpose` and `publish` come from the
      // deployment, so the internal cookie key is still the one selected.
      const encoded = await deployment.aes.encrypt(PLAINTEXT, "cbor", {
        key: { predicate: { algorithm: "dir" } },
      });

      expect(AesKit.parse(encoded).keyId).toBe(INTERNAL_COOKIE_KEY.id);
    });

    test("carries through every output mode", async () => {
      const options = { key: { predicate: { purpose: "cookie" } } };

      const record = await aegis.aes.encrypt(PLAINTEXT, "record", options);
      const serialised = await aegis.aes.encrypt(PLAINTEXT, "serialised", options);
      const cbor = await aegis.aes.encrypt(PLAINTEXT, "cbor", options);

      expect(record.keyId).toBe(COOKIE_KEY.id);
      expect(AesKit.parse(serialised).keyId).toBe(COOKIE_KEY.id);
      expect(AesKit.parse(cbor).keyId).toBe(COOKIE_KEY.id);
    });

    test("picks the CIPHER without touching the key", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { encryption: "A128CBC-HS256" },
      });

      expect(AesKit.parse(encoded).encryption).toBe("A128CBC-HS256");
      expect(AesKit.parse(encoded).keyId).toBe(TOKEN_KEY.id);
      await expect(aegis.aes.decrypt(encoded)).resolves.toBe(PLAINTEXT);
    });

    test("a selector that matches nothing throws, never falls back", async () => {
      const error = await aegis.aes
        .encrypt(PLAINTEXT, "cbor", { key: { predicate: { purpose: "none" } } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("encrypt_key_not_found");
    });
  });

  describe("injected key", () => {
    test("round-trips a key the vault has never held", async () => {
      await expect(amphora.findById(DETACHED_KEY.id)).rejects.toThrow();

      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      expect(AesKit.parse(encoded).keyId).toBe(DETACHED_KEY.id);

      await expect(
        aegis.aes.decrypt(encoded, { key: { kryptos: DETACHED_KEY } }),
      ).resolves.toBe(PLAINTEXT);
    });

    test("is not reachable through the vault — the read side MUST be given it", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      // Without the key, the ciphertext's `kid` resolves against a vault that
      // never held it, and decryption fails loudly. Encrypt succeeding while
      // decrypt failed is the gap the decrypt-side selector closes; this asserts
      // the gap is real, and that we never silently decrypt with another key.
      //
      // It surfaces as an AegisError, not amphora's own: catching AegisError is
      // the contract of this package, so a raw `kryptos_not_found_by_id` escaping
      // the `findById` branch would be invisible to a consumer that honours it.
      const error = await aegis.aes.decrypt(encoded).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_not_found");
      expect((error as AegisError).data).toMatchObject({ kid: DETACHED_KEY.id });
    });

    test("skips the SELECTOR it could never satisfy", async () => {
      // The deployment selects on a `purpose` an injected key has no reason to
      // carry. Only the FLOOR applies to it.
      const deployment = new Aegis({
        amphora,
        logger,
        encrypt: { predicate: { purpose: "token" } },
      });

      const encoded = await deployment.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      expect(AesKit.parse(encoded).keyId).toBe(DETACHED_KEY.id);
    });

    test("is REJECTED when it violates the ENCRYPT floor", async () => {
      const error = await aegis.aes
        .encrypt(PLAINTEXT, "cbor", { key: { kryptos: DETACHED_SIG_KEY } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("encrypt_key_policy_violation");
      expect((error as AegisError).data).toMatchObject({
        kid: DETACHED_SIG_KEY.id,
        floor: { use: "enc" },
      });
    });

    test("is REJECTED on decrypt when it violates the DECRYPT floor", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      const publicOnly = KryptosKit.from.jwk({
        ...TEST_EC_KEY_ENC.toJWK("public"),
        kid: AesKit.parse(encoded).keyId,
      });

      // A public half can never decrypt — `hasPrivateKey` is the decrypt floor.
      const error = await aegis.aes
        .decrypt(encoded, { key: { kryptos: publicOnly } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_policy_violation");
    });

    test("throws when it is not the key the ciphertext names", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      // Silently ignoring the supplied key would send us to a vault key that
      // cannot read this ciphertext; preferring it would decrypt with the wrong
      // key material. Both are worse than saying so.
      const error = await aegis.aes
        .decrypt(encoded, { key: { kryptos: COOKIE_KEY } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("decrypt_key_mismatch");
      expect((error as AegisError).data).toMatchObject({
        kid: DETACHED_KEY.id,
        suppliedKid: COOKIE_KEY.id,
        operation: "decrypt",
      });
    });
  });
});
