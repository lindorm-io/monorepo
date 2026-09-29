import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  type ForeignRecipientKid,
  foreignEncrypt0,
} from "../../__fixtures__/foreign-encrypt0.js";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_ENC_GCM128,
} from "../../__fixtures__/keys.js";
import {
  decodeEncryptedCoseKid,
  decryptCose,
  encryptCose,
  isEncryptedCose,
} from "./cose-encryption.js";
import { Aegis } from "../../classes/Aegis.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { coseName } from "../claims/claims-registry.js";
import { domainToWire, wireToDomain } from "../claims/translate.js";
import { coseByJose } from "../header/header-registry.js";
import { encodeCbor, Tag } from "./cbor.js";
import type { CoseLabel } from "./cose-label.js";
import { encToCoseLabel } from "./enc-labels.js";
import { COSE_TAG, encodeProtectedHeader } from "./structures.js";

// Between the fixture's issuedAt and expiresAt, so the in-kit temporal check
// accepts the round-tripped CWT.
MockDate.set(new Date(1700001000 * 1000));
afterAll(() => MockDate.reset());

const logger = createMockLogger();

const common = {
  issuer: "https://issuer.lindorm.io/",
  subject: "user-1",
  audience: ["https://rs.lindorm.io/"],
  expiresAt: new Date(1700003600 * 1000),
  issuedAt: new Date(1700000000 * 1000),
  tokenId: "the-jti",
};

// The COSE sign-then-encrypt BYTE path, pinned independently of the domain layer
// that drives it: translate the domain claims to the COSE wire, secure them as a
// COSE_Sign1, wrap that in a COSE_Encrypt0, then read the whole thing back. It
// drives the kit and the translator directly, as the mint/verify pipeline does.
describe("COSE sign-then-encrypt", () => {
  const enc = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" });

  test("round-trips through decrypt + verify", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const inner = kit.sign(domainToWire(common, coseName));
    expect(isEncryptedCose(inner)).toBe(false); // a bare signed CWT (COSE_Sign1)

    const encrypted = encryptCose({
      kryptos: enc,
      logger,
      content: inner,
      options: {},
      defaultEncryption: undefined,
    });
    expect(isEncryptedCose(encrypted)).toBe(true); // a COSE_Encrypt0
    expect(decodeEncryptedCoseKid(encrypted)).toBe(enc.id); // recipient kid, no decrypt

    const decrypted = decryptCose({
      kryptos: enc,
      logger,
      token: encrypted,
      defaultEncryption: undefined,
    });
    const { payload } = kit.verify(decrypted);
    const { claims, custom } = wireToDomain(payload, coseName, "token");

    expect({ ...claims, ...custom }).toEqual(common);
  });
});

/**
 * A COSE_Encrypt0 assembled from two header slots VERBATIM, neither of which any
 * writer here would produce. The ciphertext is a literal: every read below runs
 * before the AEAD, so nothing about it has to decrypt.
 */
const encrypt0 = (protectedSlot: unknown, unprotected: unknown): Buffer =>
  encodeCbor(
    new Tag(COSE_TAG.encrypt0, [
      protectedSlot,
      unprotected,
      Buffer.from("ciphertext", "utf8"),
    ]),
  );

/** A conformant protected bucket stating the algorithm and no key id. */
const ALG_ONLY = encodeProtectedHeader(
  new Map<number, unknown>([[coseByJose("alg"), 1]]),
);

const KID_BYTES = Buffer.from("key_probe", "utf8");

/** The IV the structure carries wherever the key id is not what a row is about. */
const IV_ONLY = new Map<number, unknown>([[coseByJose("iv"), Buffer.alloc(12)]]);

/**
 * A conformant unprotected bucket NAMING a key, so a row that falls through to it
 * proves which value answered rather than only that none did.
 */
const OTHER_KID = new Map<number, unknown>([
  [coseByJose("iv"), Buffer.alloc(12)],
  [coseByJose("kid"), Buffer.from("other_key", "utf8")],
]);

/**
 * ⚠ THE COSE_Encrypt0 KID READ RUNS BEFORE ANY KEY EXISTS. `internal/wire/
 * cose-token-wire.ts` and `internal/utils/raw-decrypt-cwe.ts` both call
 * `decodeEncryptedCoseKid` to CHOOSE the recipient key, so it shapes a stranger's
 * bytes with nothing authenticated — the door class `decode-cwt-wire.ts` holds to
 * structural refusal.
 *
 * The unprotected slot is whatever the producer wrote (RFC 9052 §3), so casting it
 * to `Map` and calling `.get` throws a raw `TypeError` on an integer, a text
 * string, an array or a byte string rather than reading as "no kid stated".
 */
describe("a COSE_Encrypt0 whose unprotected bucket is not a map", () => {
  test.each([
    ["an integer", 7],
    ["a text string", "not-a-map"],
    ["an array", []],
    ["a byte string", Buffer.alloc(2)],
    ["a text-keyed map", { kid: "key_probe" }],
  ])("reads as no kid when the bucket is %s", (_name, unprotected) => {
    expect(decodeEncryptedCoseKid(encrypt0(ALG_ONLY, unprotected))).toBeUndefined();
  });

  test("a conformant integer-keyed bucket still yields the kid", () => {
    const token = encrypt0(
      ALG_ONLY,
      new Map<number, unknown>([[coseByJose("kid"), KID_BYTES]]),
    );

    expect(decodeEncryptedCoseKid(token)).toBe("key_probe");
  });
});

/**
 * ⚠ THE PROTECTED BUCKET IS A `bstr` THAT HOLDS THE HEADER MAP AS CBOR
 * (RFC 9052 §3), which the unprotected bucket is not — so consulting it puts a
 * CBOR decode inside the unauthenticated read above. `decodeProtectedHeader`
 * (`structures.ts`) refuses a byte string holding no map and `decodeCbor` refuses
 * bytes holding no CBOR at all; either refusal escaping THIS read would be a
 * malformedness verdict raised before the AEAD, which is `CweKit.decrypt`'s to
 * raise on the whole structure.
 */
describe("a COSE_Encrypt0 whose kid rides the protected bucket", () => {
  // CBOR `a2 04 41 61 04 41 62` — the map `{4: h'61', 4: h'62'}`, one label twice,
  // which no encoder in this package will write (RFC 9052 §3).
  const DUPLICATE_LABELS = Buffer.from([0xa2, 0x04, 0x41, 0x61, 0x04, 0x41, 0x62]);

  const protectedKid = (kid: unknown): Buffer =>
    encodeProtectedHeader(
      new Map<number, unknown>([
        [coseByJose("alg"), 1],
        [coseByJose("kid"), kid],
      ]),
    );

  // A slot no protected bucket can be read out of HOLDS no `kid`, so the attribute
  // is not found there and the unprotected bucket answers (RFC 9052 §3) — the
  // opposite direction from a bucket that does hold one, below.
  test.each([
    ["an integer", 7],
    ["a map carrying the kid label", new Map<number, unknown>([[4, KID_BYTES]])],
    // ⚠ `cbor2`'s `decode` ACCEPTS A HEX STRING, so without the
    // `instanceof Uint8Array` guard in `readProtectedHeader` (`structures.ts`) this
    // slot's own text decodes to `{4: h'hijacked'}` and names the key.
    ["a text string of hex-encoded CBOR", "a1044868696a61636b6564"],
    ["a zero-length byte string", Buffer.alloc(0)],
    ["a byte string holding no CBOR", Buffer.from([0xff])],
    ["a byte string holding an integer", encodeCbor(42)],
    ["a byte string holding an array", encodeCbor([1, 2])],
    ["a byte string holding a text-keyed map", encodeCbor({ kid: "key_probe" })],
    ["a byte string holding one label twice", DUPLICATE_LABELS],
  ])(
    "falls through to the kid the unprotected bucket names when the protected slot is %s",
    (_name, protectedSlot) => {
      expect(decodeEncryptedCoseKid(encrypt0(protectedSlot, OTHER_KID))).toBe(
        "other_key",
      );
    },
  );

  test("a kid the AEAD covers is the kid, with none stated unprotected", () => {
    expect(decodeEncryptedCoseKid(encrypt0(protectedKid(KID_BYTES), IV_ONLY))).toBe(
      "key_probe",
    );
  });

  // RFC 9052 §3: the unprotected bucket answers only where the protected states
  // none, so the bucket whoever last held the token could rewrite never decides
  // which key a recipient asks the vault for.
  test("the protected kid answers where the unprotected bucket names another key", () => {
    const token = encrypt0(
      protectedKid(KID_BYTES),
      new Map<number, unknown>([[coseByJose("kid"), Buffer.from("other_key", "utf8")]]),
    );

    expect(decodeEncryptedCoseKid(token)).toBe("key_probe");
  });

  // RFC 9052 §3: the unprotected bucket answers only where the attribute is NOT
  // FOUND in the protected one, so PRESENCE decides and the value does not — and
  // `Map.get` answers `null` for the CBOR null and `undefined` for the CBOR
  // undefined, the two stated values a `??` would read as a bucket holding nothing.
  test.each([
    ["a text string", "key_probe"],
    ["the CBOR null", null],
    ["the CBOR undefined", undefined],
  ])(
    "a protected kid held as %s stops the fallback and reads as no kid",
    (_name, kid) => {
      const token = encrypt0(
        protectedKid(kid),
        new Map<number, unknown>([[coseByJose("kid"), Buffer.from("other_key", "utf8")]]),
      );

      expect(decodeEncryptedCoseKid(token)).toBeUndefined();
    },
  );

  test("reads as no kid when neither bucket states one", () => {
    expect(decodeEncryptedCoseKid(encrypt0(ALG_ONLY, IV_ONLY))).toBeUndefined();
  });
});

/**
 * ⭐ THE READ IS WHAT CHOOSES THE RECIPIENT KEY, and a read stating no kid costs
 * the whole decrypt rather than just the hint: `aegis.decrypt` and
 * `aegis.cwe.decrypt` both hand this answer to the vault
 * (`internal/wire/cose-token-wire.ts`, `internal/utils/raw-decrypt-cwe.ts`), and
 * nothing searches — a kid-less read is refused `decrypt_key_missing_kid` before
 * any AEAD runs (`internal/utils/resolve-key.ts`).
 *
 * Every token here is a FOREIGN producer's. aegis writes `kid` unprotected, and
 * the protected bucket IS the AEAD's AAD (RFC 9052 §5.3), so the parameter cannot
 * be relocated after minting.
 */
describe("the recipient key a foreign COSE_Encrypt0 names", () => {
  const PLAINTEXT = Buffer.from("sealed bytes", "utf8");

  /** The issuer the `dir` recipients in `__fixtures__/keys.ts` are registered to. */
  const VAULT_ISSUER = "https://test.lindorm.io/";

  let amphora: IAmphora;
  let aegis: Aegis;

  const foreign = (recipientKid: ForeignRecipientKid): string =>
    foreignEncrypt0(
      TEST_OCT_KEY_ENC,
      new Map<CoseLabel, unknown>([[coseByJose("alg"), encToCoseLabel("A256GCM")]]),
      PLAINTEXT,
      recipientKid,
    ).toString("base64url");

  beforeEach(async () => {
    amphora = new Amphora({ internal: { issuer: VAULT_ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    // TWO recipients, so the key that answers is the one the token named rather
    // than the only one the vault holds.
    amphora.add(TEST_OCT_KEY_ENC);
    amphora.add(TEST_OCT_KEY_ENC_GCM128);
  });

  test("a kid in the protected bucket alone resolves the key and decrypts", async () => {
    await expect(aegis.cwe.decrypt(foreign("protected"))).resolves.toMatchObject({
      payload: PLAINTEXT,
    });
    await expect(aegis.decrypt(foreign("protected"))).resolves.toMatchObject({
      payload: PLAINTEXT,
    });
  });

  test("a kid in the unprotected bucket alone resolves the key and decrypts", async () => {
    await expect(aegis.cwe.decrypt(foreign("unprotected"))).resolves.toMatchObject({
      payload: PLAINTEXT,
    });
    await expect(aegis.decrypt(foreign("unprotected"))).resolves.toMatchObject({
      payload: PLAINTEXT,
    });
  });

  test("a protected kid held as the CBOR null is refused rather than resolved from the unprotected bucket", async () => {
    await expect(aegis.cwe.decrypt(foreign("protected-null"))).rejects.toMatchObject({
      code: "decrypt_key_missing_kid",
    });
    await expect(aegis.decrypt(foreign("protected-null"))).rejects.toMatchObject({
      code: "decrypt_key_missing_kid",
    });
  });

  test("a token naming no key in either bucket is refused rather than searched for", async () => {
    await expect(aegis.cwe.decrypt(foreign("neither"))).rejects.toMatchObject({
      code: "decrypt_key_missing_kid",
    });
    await expect(aegis.decrypt(foreign("neither"))).rejects.toMatchObject({
      code: "decrypt_key_missing_kid",
    });
  });
});
