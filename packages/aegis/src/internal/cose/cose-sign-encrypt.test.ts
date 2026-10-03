import { AesError } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  type ForeignNonceBucket,
  type ForeignRecipientKid,
  foreignEncrypt0,
} from "../../__fixtures__/foreign-encrypt0.js";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_ENC_GCM128,
} from "../../__fixtures__/keys.js";
import { spliceCoseSlot } from "../../__fixtures__/splice-cose-slot.js";
import { CoseError, CweError } from "../../errors/index.js";
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
import { decodeCbor, encodeCbor, Tag } from "./cbor.js";
import type { CoseLabel } from "./cose-label.js";
import { encToCoseLabel } from "./enc-labels.js";
import { COSE_TAG, decodeProtectedHeader, encodeProtectedHeader } from "./structures.js";

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
      certBindingMode: "strict",
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
 * bytes holding no CBOR at all; neither refusal escapes THIS read, because the
 * malformedness verdict is `CweKit.decode`'s, which both callers run before it
 * ("a malformed COSE_Encrypt0", below).
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

  test("a protected kid held as a text string is refused rather than resolved", async () => {
    const token = foreignEncrypt0(
      TEST_OCT_KEY_ENC,
      new Map<CoseLabel, unknown>([
        [coseByJose("alg"), encToCoseLabel("A256GCM")],
        [coseByJose("kid"), TEST_OCT_KEY_ENC.id], // RFC 9052 §3.1
      ]),
      PLAINTEXT,
      "unprotected",
    ).toString("base64url");

    await expect(aegis.cwe.decrypt(token)).rejects.toMatchObject({
      code: "decrypt_key_missing_kid",
    });
    await expect(aegis.decrypt(token)).rejects.toMatchObject({
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

/**
 * ⭐ THE AEAD'S IV IS READ PROTECTED-FIRST, ON PRESENCE (RFC 9052 §3), so the IV
 * `aegis.decrypt` reports is the one the token decrypted with. aegis writes its IV
 * unprotected and accepts one in either bucket (RFC 9052 §3.1).
 *
 * Every token seals a signed CWT, so `aegis.verify` opens the same bytes as the
 * two decrypt doors. It reports the inner token's header, so it is pinned on its
 * verdict alone.
 */
describe("the IV a foreign COSE_Encrypt0 carries", () => {
  const VAULT_ISSUER = "https://test.lindorm.io/";
  const DECOY = Buffer.from("decoy-nonce!", "utf8");
  const IV = coseByJose("iv");

  const SIGNED_CWT = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(
    domainToWire({ ...common, issuer: VAULT_ISSUER }, coseName),
  );

  let aegis: Aegis;

  const sealed = (
    ivEntries: ReadonlyArray<[CoseLabel, unknown]>,
    nonceBucket: ForeignNonceBucket,
  ): Buffer =>
    foreignEncrypt0(
      TEST_OCT_KEY_ENC,
      new Map<CoseLabel, unknown>([
        [coseByJose("alg"), encToCoseLabel("A256GCM")],
        [coseByJose("cty"), "application/cwt"],
        ...ivEntries,
      ]),
      SIGNED_CWT,
      "unprotected",
      nonceBucket,
    );

  /** No AEAD covers the unprotected bucket (RFC 9052 §3), so the token stays valid. */
  const withUnprotectedIv = (token: Buffer, iv: Buffer): Buffer => {
    const [, unprotected] = decodeCbor<Tag>(token).contents as [unknown, unknown];
    const bucket = new Map(unprotected as Map<CoseLabel, unknown>);

    bucket.set(IV, iv);

    return spliceCoseSlot(token, 1, bucket);
  };

  /** The IV the protected bucket states, spelled as the domain header spells it. */
  const protectedIv = (token: Buffer): string => {
    const [protectedBstr] = decodeCbor<Tag>(token).contents as [Uint8Array];

    return Buffer.from(
      decodeProtectedHeader(protectedBstr, CweError).get(IV) as Uint8Array,
    ).toString("base64url");
  };

  const DOORS: ReadonlyArray<
    [door: string, open: (token: Buffer) => Promise<unknown>, accepted: object]
  > = [
    [
      "aegis.decrypt",
      (token) => aegis.decrypt(token.toString("base64url")),
      { payload: SIGNED_CWT },
    ],
    [
      "aegis.cwe.decrypt",
      (token) => aegis.cwe.decrypt(token.toString("base64url")),
      { payload: SIGNED_CWT },
    ],
    [
      "aegis.verify",
      (token) => aegis.verify(token.toString("base64url")),
      { format: "cwt", wrapper: "cwe", claims: { subject: common.subject } },
    ],
  ];

  beforeEach(async () => {
    const amphora: IAmphora = new Amphora({ internal: { issuer: VAULT_ISSUER }, logger });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TEST_OCT_KEY_ENC);
    amphora.add(TEST_EC_KEY_SIG);
  });

  test.each(DOORS)(
    "%s opens a token whose IV rides the unprotected bucket alone",
    async (_door, open, accepted) => {
      await expect(open(sealed([], "unprotected"))).resolves.toMatchObject(accepted);
    },
  );

  test.each(DOORS)(
    "%s opens a token whose IV rides the protected bucket alone",
    async (_door, open, accepted) => {
      await expect(open(sealed([], "protected"))).resolves.toMatchObject(accepted);
    },
  );

  test.each(DOORS)(
    "%s opens a token with its protected IV where the unprotected bucket carries a decoy",
    async (_door, open, accepted) => {
      const token = withUnprotectedIv(sealed([], "protected"), DECOY);

      await expect(open(token)).resolves.toMatchObject(accepted);
    },
  );

  test.each([
    ["the protected bucket alone", () => sealed([], "protected")],
    [
      "the protected bucket beside an unprotected decoy",
      () => withUnprotectedIv(sealed([], "protected"), DECOY),
    ],
  ])(
    "aegis.decrypt reports the IV it decrypted with when that IV rides %s",
    async (_name, mint) => {
      const token = mint();

      const { header } = await aegis.decrypt(token.toString("base64url"));

      expect(header.initialisationVector).toBe(protectedIv(token));
    },
  );

  // The AEAD runs on the decoy, so authentication fails — the verdict
  // "rejects tampered ciphertext" in `CweKit.test.ts` pins for the kit.
  test.each(DOORS)(
    "%s refuses a token whose protected IV is a decoy the AEAD never ran with",
    async (_door, open) => {
      const token = sealed([[IV, DECOY]], "unprotected");

      await expect(open(token)).rejects.toBeInstanceOf(AesError);
      await expect(open(token)).rejects.toMatchObject({ code: "decryption_failed" });
    },
  );

  // `Map.get` answers `null` for the CBOR null and `undefined` for the CBOR
  // undefined, both values the producer stated in the protected bucket.
  describe.each([
    ["the CBOR null", null],
    ["the CBOR undefined", undefined],
  ])("a protected IV stated as %s beside a real unprotected IV", (_name, iv) => {
    test.each(DOORS)(
      "%s refuses it rather than decrypting with the unprotected IV",
      async (_door, open) => {
        const token = sealed([[IV, iv]], "unprotected");

        await expect(open(token)).rejects.toBeInstanceOf(CweError);
        await expect(open(token)).rejects.toMatchObject({ code: "cose_malformed" });
      },
    );
  });
});

/**
 * A malformed COSE_Encrypt0 answers one structural verdict at every door that
 * opens it. No token needs to decrypt, because each is refused before any key is
 * used.
 */
describe("a malformed COSE_Encrypt0", () => {
  const VAULT_ISSUER = "https://test.lindorm.io/";
  const ALG = coseByJose("alg");

  let aegis: Aegis;

  beforeEach(async () => {
    const amphora: IAmphora = new Amphora({ internal: { issuer: VAULT_ISSUER }, logger });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();
  });

  const DOORS: ReadonlyArray<[door: string, open: (token: Buffer) => Promise<unknown>]> =
    [
      ["aegis.decrypt", (token) => aegis.decrypt(token.toString("base64url"))],
      ["aegis.verify", (token) => aegis.verify(token.toString("base64url"))],
      ["aegis.cwe.decrypt", (token) => aegis.cwe.decrypt(token.toString("base64url"))],
    ];

  // ⭐ THE STRUCTURE IS READ BEFORE THE KEY. These tokens name no key, and the kid
  // read reads a malformed header slot as no kid (above), so a door resolving the
  // key first refuses them `decrypt_key_missing_kid` instead.
  //
  // ⚠ Matched on `constructor`: `CweError` extends `CoseError`, so
  // `toBeInstanceOf(CoseError)` passes either class.
  describe.each([
    [
      "a protected byte string holding no CBOR",
      "cbor_decode_failed",
      CoseError,
      encrypt0(Buffer.from([0xff]), IV_ONLY),
    ],
    [
      "a protected byte string holding an integer",
      "cose_malformed",
      CweError,
      encrypt0(encodeCbor(1), IV_ONLY),
    ],
    [
      "a protected slot that is not a byte string",
      "cose_malformed",
      CweError,
      encrypt0(7, IV_ONLY),
    ],
    [
      "two elements",
      "cose_malformed",
      CweError,
      encodeCbor(new Tag(COSE_TAG.encrypt0, [ALG_ONLY, IV_ONLY])),
    ],
    [
      "a content-encryption label no algorithm answers to",
      "cose_encryption_not_supported",
      CoseError,
      encrypt0(encodeProtectedHeader(new Map<number, unknown>([[ALG, 9999]])), IV_ONLY),
    ],
    [
      "a typ that is not a text string",
      "cose_header_typ_invalid",
      CoseError,
      encrypt0(
        encodeProtectedHeader(
          new Map<number, unknown>([
            [ALG, 1],
            [coseByJose("typ"), 0],
          ]),
        ),
        IV_ONLY,
      ),
    ],
  ])("naming no key, with %s, is refused as %s", (_shape, code, errorClass, token) => {
    test.each(DOORS)("by %s", async (_door, open) => {
      await expect(open(token)).rejects.toMatchObject({ constructor: errorClass, code });
    });
  });

  // The decrypt doors are handed the key, so neither resolves one. The IV is
  // absent, so a door reaching the kit's IV read before any read of the protected
  // bucket answers `cose_malformed` instead.
  describe("carrying no IV, with a protected byte string holding no CBOR, is refused as cbor_decode_failed", () => {
    const KEY = { kryptos: TEST_OCT_KEY_ENC };
    const TOKEN = encrypt0(Buffer.from([0xff]), new Map());

    test.each([
      [
        "aegis.decrypt, its key supplied",
        () => aegis.decrypt(TOKEN.toString("base64url"), { key: KEY }),
      ],
      [
        "aegis.verify, whose outer read takes no key",
        () => aegis.verify(TOKEN.toString("base64url")),
      ],
      [
        "aegis.cwe.decrypt, its key supplied",
        () => aegis.cwe.decrypt(TOKEN.toString("base64url"), { key: KEY }),
      ],
    ])("by %s", async (_door, open) => {
      await expect(open()).rejects.toMatchObject({
        constructor: CoseError,
        code: "cbor_decode_failed",
      });
    });
  });
});
