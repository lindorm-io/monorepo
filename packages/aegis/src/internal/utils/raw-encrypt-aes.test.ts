import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_ENC, TEST_OCT_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { AegisError } from "../../errors/index.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const PLAINTEXT = "cookie-session-payload";

/**
 * The AES namespace's WRITE side (`aegis.aes.encrypt`).
 *
 * ⚠ Not a conformance row and it cannot be: an AES record is neither a JOSE nor
 * a COSE token — it has no header the wire inspector can read and no wire to
 * state a capability on — so it lives beside the function under test.
 *
 * The pylon shape motivates the whole surface: ONE `Aegis` for a deployment, and
 * enc keys with different jobs. Without a per-call selector the AES path could
 * only ask the deployment-wide enc policy, which hands back the newest published
 * token key — so a cookie was sealed with the key published to the world while
 * the internal `dir` key that exists for exactly that job went unused.
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

// A published cookie key, OLDER than the token key — so a `{ purpose: "cookie" }`
// selector has to beat the sort to be observable at all.
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
// `publish: false` hides a key from SELECTION and not only from publication, so
// a consumer reaching for it must say so — amphora's queries start from the
// published set. That opt-in is the selector's job, which is why `publish` stays
// a caller attribute rather than part of aegis's floor.
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

// A key the vault never held. Sealing with it is the case an injected key exists
// for; being unable to read it back again is what the decrypt-side selector
// prevents (see `raw-decrypt-aes.test.ts`).
const DETACHED_KEY = KryptosKit.from.b64({
  ...octEnc(
    "f1a2b3c4-0004-5aaa-9bbb-0123456789ab",
    "PGfkV3lCX92QGq3cCbt8E01GkOyub6bQbfuWyktr2pY",
  ),
  purpose: "detached",
});

// Same, but a SIGNING key — an injected key is floor-checked like any other.
const DETACHED_SIG_KEY = KryptosKit.clone(TEST_OCT_KEY_SIG, { purpose: "detached" });

/**
 * A key that DECLARES an `encryption` states what it is, and aegis honours it.
 * Both keys below declare something OTHER than `A256GCM`, so a kit- or
 * deployment-level default that still won would be visible on the record.
 *
 * The two families answer differently and are therefore both covered:
 *
 *   `dir`     — the declaration is BINDING. The secret is sized for it (a
 *               48-byte secret is `A192CBC-HS384` and nothing else), so
 *               overriding it does not pick another cipher, it fails.
 *   WRAPPING  — the declaration is a STATEMENT. The content-encryption key is
 *               generated per message, so any AEAD would "work" — which is
 *               exactly why an override here would be silent rather than loud.
 */
const DIR_KEY = KryptosKit.generate.auto({
  algorithm: "dir",
  encryption: "A192CBC-HS384",
  purpose: "declared-dir",
  publish: false,
  internal: true,
});

const WRAP_KEY = KryptosKit.generate.auto({
  algorithm: "A256KW",
  encryption: "A128GCM",
  purpose: "declared-wrap",
  publish: false,
  internal: true,
});

describe("rawEncryptAes — the AES write side", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TOKEN_KEY);
    amphora.add(COOKIE_KEY);
    amphora.add(INTERNAL_COOKIE_KEY);
  });

  describe("with no per-call selector", () => {
    test("seals with the newest published enc key", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT);

      expect(AesKit.parse(encoded).keyId).toBe(TOKEN_KEY.id);
    });

    test("honours the deployment encrypt policy", async () => {
      const deployment = new Aegis({
        amphora,
        logger,
        encrypt: { condition: { purpose: "cookie" } },
      });

      expect(AesKit.parse(await deployment.aes.encrypt(PLAINTEXT)).keyId).toBe(
        COOKIE_KEY.id,
      );
    });

    // RFC 7518 §4.6.2 defines `apu`/`apv` as the PartyUInfo/PartyVInfo inputs to
    // the ECDH-ES key-derivation function, so they are part of what the derived
    // key IS — a value accepted and dropped derives a different key on the two
    // sides and the record cannot be read back.
    test("forwards the ECDH-ES party info onto the record", async () => {
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
  });

  describe("with a per-call selector", () => {
    test("selects the cookie key over a newer published enc key", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { condition: { purpose: "cookie" } },
      });

      expect(AesKit.parse(encoded).keyId).toBe(COOKIE_KEY.id);
      expect(AesKit.parse(encoded).keyId).not.toBe(TOKEN_KEY.id);
    });

    test("reaches the internal, unpublished cookie key", async () => {
      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { condition: { purpose: "cookie", publish: false } },
      });

      expect(AesKit.parse(encoded).keyId).toBe(INTERNAL_COOKIE_KEY.id);
    });

    test("overrides the deployment-level encrypt policy — the caller wins", async () => {
      const deployment = new Aegis({
        amphora,
        logger,
        encrypt: { condition: { purpose: "token" } },
      });

      const byDeployment = await deployment.aes.encrypt(PLAINTEXT);
      const byCall = await deployment.aes.encrypt(PLAINTEXT, "cbor", {
        key: { condition: { purpose: "cookie" } },
      });

      expect(AesKit.parse(byDeployment).keyId).toBe(TOKEN_KEY.id);
      expect(AesKit.parse(byCall).keyId).toBe(COOKIE_KEY.id);
    });

    // The merge is SHALLOW: the caller names the algorithm, `purpose` and
    // `publish` come from the deployment, so the internal cookie key is still
    // the one selected. A replacement would silently widen every call that
    // narrowed on one field.
    test("keeps an unmentioned deployment field", async () => {
      const deployment = new Aegis({
        amphora,
        logger,
        encrypt: { condition: { purpose: "cookie", publish: false } },
      });

      const encoded = await deployment.aes.encrypt(PLAINTEXT, "cbor", {
        key: { condition: { algorithm: "dir" } },
      });

      expect(AesKit.parse(encoded).keyId).toBe(INTERNAL_COOKIE_KEY.id);
    });

    test("carries through every output mode", async () => {
      const options = { key: { condition: { purpose: "cookie" } } };

      const record = await aegis.aes.encrypt(PLAINTEXT, "record", options);
      const serialised = await aegis.aes.encrypt(PLAINTEXT, "serialised", options);
      const cbor = await aegis.aes.encrypt(PLAINTEXT, "cbor", options);

      expect(record.keyId).toBe(COOKIE_KEY.id);
      expect(AesKit.parse(serialised).keyId).toBe(COOKIE_KEY.id);
      expect(AesKit.parse(cbor).keyId).toBe(COOKIE_KEY.id);
    });

    test("throws when it matches nothing rather than falling back", async () => {
      const error = await aegis.aes
        .encrypt(PLAINTEXT, "cbor", { key: { condition: { purpose: "none" } } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("encrypt_key_not_found");
    });
  });

  describe("with an injected key", () => {
    test("seals with a key the vault has never held", async () => {
      await expect(amphora.findById(DETACHED_KEY.id)).rejects.toThrow();

      const encoded = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      expect(AesKit.parse(encoded).keyId).toBe(DETACHED_KEY.id);
    });

    // A key that never came from the vault cannot satisfy a vault query, so
    // checking it against the SELECTOR would reject the exact case injection
    // exists for. Only the FLOOR applies to it.
    test("skips the selector it could never satisfy", async () => {
      const deployment = new Aegis({
        amphora,
        logger,
        encrypt: { condition: { purpose: "token" } },
      });

      const encoded = await deployment.aes.encrypt(PLAINTEXT, "cbor", {
        key: { kryptos: DETACHED_KEY },
      });

      expect(AesKit.parse(encoded).keyId).toBe(DETACHED_KEY.id);
    });

    test("is refused when it violates the encrypt floor", async () => {
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
  });

  /**
   * A key's own `encryption` is a statement about what that key material IS, so
   * it outranks any default: a deployment default exists for a key that declares
   * nothing, and treating it as an override would seal with a cipher the key was
   * never sized for.
   */
  describe("the key's declared encryption", () => {
    const aegisFor = (defaultEncryption?: "A256GCM" | "A128GCM"): Aegis =>
      new Aegis({ amphora, logger, ...(defaultEncryption ? { defaultEncryption } : {}) });

    describe.each<[string, IKryptos, string]>([
      ["dir", DIR_KEY, "A192CBC-HS384"],
      ["wrapping", WRAP_KEY, "A128GCM"],
    ])("a %s key", (_family, kryptos, declared) => {
      beforeEach(() => {
        amphora.add(kryptos);
      });

      test("seals with the declared encryption and round-trips", async () => {
        const sealed = await aegisFor().aes.encrypt(PLAINTEXT, "cbor", {
          key: { kryptos },
        });

        expect(AesKit.parse(sealed).encryption).toBe(declared);
        await expect(aegisFor().aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
      });

      test("is not overridden by the deployment default", async () => {
        const aegis = aegisFor("A256GCM");
        const sealed = await aegis.aes.encrypt(PLAINTEXT, "cbor", { key: { kryptos } });

        expect(AesKit.parse(sealed).encryption).toBe(declared);
        await expect(aegis.aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
      });

      // The declaration is a property of the KEY, so where the key came from
      // cannot change the answer.
      test("is honoured the same for a vault-resolved key as for an injected one", async () => {
        const aegis = aegisFor("A256GCM");
        const sealed = await aegis.aes.encrypt(PLAINTEXT, "cbor", {
          // `publish: false` is what makes an internal key reachable at all —
          // amphora's default query is the published set.
          key: { condition: { id: kryptos.id, publish: false } },
        });

        expect(AesKit.parse(sealed).keyId).toBe(kryptos.id);
        expect(AesKit.parse(sealed).encryption).toBe(declared);
        await expect(aegis.aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
      });
    });

    // The fallback's ONLY job: a recipient key that declares nothing. An
    // imported peer JWK carries no `enc` — it is not a standard JWK member — so
    // the deployment has to supply one. It is a fallback, never an override,
    // which is why it can never conflict with the cases above.
    describe("a key that declares nothing", () => {
      const bare = (): IKryptos => {
        const kryptos = KryptosKit.from.jwk({
          ...WRAP_KEY.toJWK("private"),
          enc: undefined,
        });
        amphora.add(kryptos);
        return kryptos;
      };

      test("falls back to the deployment default", async () => {
        const kryptos = bare();
        const aegis = aegisFor("A128GCM");

        const sealed = await aegis.aes.encrypt(PLAINTEXT, "cbor", { key: { kryptos } });

        expect(kryptos.encryption).toBeNull();
        expect(AesKit.parse(sealed).encryption).toBe("A128GCM");
        await expect(aegis.aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
      });

      test("falls back to A256GCM when the deployment names none", async () => {
        const kryptos = bare();
        const aegis = aegisFor();

        const sealed = await aegis.aes.encrypt(PLAINTEXT, "cbor", { key: { kryptos } });

        expect(AesKit.parse(sealed).encryption).toBe("A256GCM");
        await expect(aegis.aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
      });
    });
  });
});
