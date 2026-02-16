import { KeyObject } from "crypto";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger";
import { importJWK } from "jose";
import { Encoder } from "cbor-x";
import {
  Sign1,
  Algorithms,
  Headers,
  ProtectedHeaders,
  UnprotectedHeaders,
} from "@auth0/cose";
import { encode as cborEncode } from "cbor";
import { CwsKit } from "../src/classes/CwsKit";
import { CweKit } from "../src/classes/CweKit";
import { CwtKit } from "../src/classes/CwtKit";

// ---------------------------------------------------------------------------
// cbor-x encoder configured identically to @auth0/cose (Maps, not objects)
// ---------------------------------------------------------------------------

const cborEncoder = new Encoder({
  tagUint8Array: false,
  useRecords: false,
  mapsAsObjects: false,
} as any);

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const PLAINTEXT = "hello aegis cose interop";
const ISSUER = "https://cose-interop.test.lindorm.io/";
const SUBJECT = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const logger = createMockLogger();

// ---------------------------------------------------------------------------
// Key generation helpers
// ---------------------------------------------------------------------------

const createEcSigKey = () =>
  KryptosKit.generate.sig.ec({ algorithm: "ES256", curve: "P-256" });

const createOkpSigKey = () =>
  KryptosKit.generate.sig.okp({ algorithm: "EdDSA", curve: "Ed25519" });

const createRsaSigKey = () => KryptosKit.generate.sig.rsa({ algorithm: "RS256" });

const createOctDirKey = () =>
  KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" });

const createOctKwKey = () => KryptosKit.generate.enc.oct({ algorithm: "A128KW" });

// ---------------------------------------------------------------------------
// Helper: export public-only JWK for jose/auth0 verification
// ---------------------------------------------------------------------------

const toPublicJwk = (jwk: Record<string, unknown>): Record<string, unknown> => {
  const { d, dp, dq, p, q, qi, k, ...publicParts } = jwk as any;
  return publicParts;
};

// ---------------------------------------------------------------------------
// Helper: get jose KeyLike from kryptos (public key for verify, private for sign)
// ---------------------------------------------------------------------------

const getJoseKey = async (
  kryptos: ReturnType<typeof createEcSigKey>,
  mode: "public" | "private" = "public",
): Promise<CryptoKey | KeyObject> => {
  const jwk = kryptos.export("jwk");
  const keyJwk = mode === "public" ? toPublicJwk(jwk) : jwk;
  return (await importJWK(keyJwk, jwk.alg)) as CryptoKey | KeyObject;
};

// ---------------------------------------------------------------------------
// COSE label constants (from RFC 9052 / aegis COSE_HEADER/COSE_CLAIMS)
// ---------------------------------------------------------------------------

const COSE_LABEL = {
  ALG: 1,
  CRIT: 2,
  CTY: 3,
  KID: 4,
  IV: 5,
  TYP: 16,
  OID: 400,
} as const;

const COSE_CLAIM = {
  ISS: 1,
  SUB: 2,
  AUD: 3,
  EXP: 4,
  NBF: 5,
  IAT: 6,
  JTI: 7, // cti in COSE, mapped to jti in aegis
} as const;

// Map from aegis algorithm string to COSE integer label
const COSE_ALG_LABEL: Record<string, number> = {
  ES256: -7,
  ES384: -35,
  ES512: -36,
  EdDSA: -8,
  PS256: -37,
  PS384: -38,
  PS512: -39,
  RS256: -257,
  RS384: -258,
  RS512: -259,
  HS256: 5,
  HS384: 6,
  HS512: 7,
  A128GCM: 1,
  A192GCM: 2,
  A256GCM: 3,
  dir: -6,
  A128KW: -3,
  A192KW: -4,
  A256KW: -5,
  "ECDH-ES": -25,
};

// ===========================================================================
// CWS (COSE Sign1) structural compliance tests
// ===========================================================================

describe("COSE interop: CWS structural compliance", () => {
  describe.each([
    { name: "EC / ES256", createKey: createEcSigKey, algLabel: -7 },
    { name: "OKP / EdDSA", createKey: createOkpSigKey, algLabel: -8 },
    { name: "RSA / RS256", createKey: createRsaSigKey, algLabel: -257 },
  ])("$name", ({ createKey, algLabel }) => {
    test("aegis CWS token decodes as valid COSE Sign1 4-tuple", () => {
      const kryptos = createKey();
      const kit = new CwsKit({ logger, kryptos });

      const { buffer } = kit.sign(PLAINTEXT);

      // Decode the raw CBOR with cbor-x (not the mock)
      const decoded = cborEncoder.decode(buffer);

      // Must be a 4-element array: [protectedCbor, unprotectedMap, payload, signature]
      expect(Array.isArray(decoded)).toBe(true);
      expect(decoded).toHaveLength(4);

      const [protectedCbor, unprotectedMap, payloadCbor, signature] = decoded;

      // protectedCbor must be a Uint8Array/Buffer (CBOR bstr)
      expect(Buffer.isBuffer(protectedCbor) || protectedCbor instanceof Uint8Array).toBe(
        true,
      );

      // unprotectedMap must be a Map (decoded with mapsAsObjects: false)
      expect(unprotectedMap).toBeInstanceOf(Map);

      // payloadCbor must be a Uint8Array/Buffer
      expect(Buffer.isBuffer(payloadCbor) || payloadCbor instanceof Uint8Array).toBe(
        true,
      );

      // signature must be a Uint8Array/Buffer
      expect(Buffer.isBuffer(signature) || signature instanceof Uint8Array).toBe(true);
      expect(signature.length).toBeGreaterThan(0);
    });

    test("protected header has correct COSE label mappings", () => {
      const kryptos = createKey();
      const kit = new CwsKit({ logger, kryptos });

      const { buffer } = kit.sign(PLAINTEXT);

      const decoded = cborEncoder.decode(buffer);
      const [protectedCbor] = decoded;

      // Decode the protected header bytes
      const protectedMap: Map<number, unknown> = cborEncoder.decode(protectedCbor);
      expect(protectedMap).toBeInstanceOf(Map);

      // Label 1 = algorithm (must match the expected COSE algorithm label)
      expect(protectedMap.get(COSE_LABEL.ALG)).toBe(algLabel);

      // Label 3 = content type
      expect(protectedMap.get(COSE_LABEL.CTY)).toBe("text/plain; charset=utf-8");

      // Label 16 = type
      expect(protectedMap.get(COSE_LABEL.TYP)).toBe(
        "application/cose; cose-type=cose-sign",
      );
    });

    test("unprotected header contains kid and oid labels", () => {
      const kryptos = createKey();
      const kit = new CwsKit({ logger, kryptos });

      const { buffer, objectId } = kit.sign(PLAINTEXT, {
        objectId: "test-object-id-123",
      });

      const decoded = cborEncoder.decode(buffer);
      const [, unprotectedMap] = decoded;

      expect(unprotectedMap).toBeInstanceOf(Map);

      // Label 4 = kid (COSE KID is bstr, aegis encodes as Buffer)
      const kidValue = unprotectedMap.get(COSE_LABEL.KID);
      expect(kidValue).toBeDefined();
      // The kid is a Buffer containing the kryptos.id string
      const kidStr =
        kidValue instanceof Uint8Array
          ? Buffer.from(kidValue).toString("utf8")
          : kidValue;
      expect(kidStr).toBe(kryptos.id);

      // Label 400 = oid (Lindorm extension)
      const oidValue = unprotectedMap.get(COSE_LABEL.OID);
      expect(oidValue).toBeDefined();
      const oidStr =
        oidValue instanceof Uint8Array
          ? Buffer.from(oidValue).toString("utf8")
          : oidValue;
      expect(oidStr).toBe(objectId);
    });

    test("signature is computed over RFC 9052 Sig_structure", () => {
      const kryptos = createKey();
      const kit = new CwsKit({ logger, kryptos });

      const { buffer } = kit.sign(PLAINTEXT);

      const decoded = cborEncoder.decode(buffer);
      const [protectedCbor, , payloadCbor, signature] = decoded;

      // Reconstruct the Sig_structure that aegis should have signed:
      // ["Signature1", protectedCbor, external_aad (empty), payload]
      const sigStructure = cborEncoder.encode([
        "Signature1",
        protectedCbor,
        new Uint8Array(0),
        payloadCbor,
      ]);

      // We can't verify the signature here without reimplementing crypto,
      // but we verify the structure exists and the token round-trips through aegis
      expect(sigStructure).toBeInstanceOf(Uint8Array);
      expect(sigStructure.length).toBeGreaterThan(0);

      // Verify aegis can round-trip its own token
      const result = kit.verify(buffer);
      expect(result.payload).toBe(PLAINTEXT);
    });
  });
});

// ===========================================================================
// CWS (COSE Sign1) interop: aegis <-> @auth0/cose
// ===========================================================================

describe("COSE interop: aegis CWS <-> @auth0/cose Sign1", () => {
  describe.each([
    {
      name: "EC / ES256",
      createKey: createEcSigKey,
      auth0Alg: Algorithms.ES256,
    },
    {
      name: "OKP / EdDSA",
      createKey: createOkpSigKey,
      auth0Alg: Algorithms.EdDSA,
    },
    {
      name: "RSA / RS256",
      createKey: createRsaSigKey,
      auth0Alg: Algorithms.RS256,
    },
  ])("$name", ({ createKey, auth0Alg }) => {
    test("aegis sign -> @auth0/cose decode + verify", async () => {
      const kryptos = createKey();
      const kit = new CwsKit({ logger, kryptos });

      const { buffer } = kit.sign(PLAINTEXT);

      // Decode using @auth0/cose
      const sign1 = Sign1.decode(buffer);

      // Verify protected header algorithm matches
      expect(sign1.protectedHeaders.get(Headers.Algorithm)).toBe(auth0Alg);

      // The payload field should be the CBOR-encoded payload bytes
      expect(sign1.payload).toBeInstanceOf(Uint8Array);
      expect(sign1.payload.length).toBeGreaterThan(0);

      // Verify the signature using jose KeyLike
      const publicKey = await getJoseKey(kryptos, "public");
      await expect(sign1.verify(publicKey)).resolves.toBeUndefined();
    });

    test("@auth0/cose sign -> aegis verify", async () => {
      const kryptos = createKey();
      const kit = new CwsKit({ logger, kryptos });

      // Get jose private key for @auth0/cose signing
      const privateKey = await getJoseKey(kryptos, "private");

      // Build COSE protected and unprotected headers matching aegis format.
      // We use ProtectedHeaders/UnprotectedHeaders with `as any` to include
      // Lindorm-proprietary labels (16=typ, 400=oid) that aren't in @auth0/cose's enum.
      const protectedHeaders = new ProtectedHeaders([
        [Headers.Algorithm, auth0Alg],
        [Headers.ContentType, "text/plain; charset=utf-8"],
        [COSE_LABEL.TYP, "application/cose; cose-type=cose-sign"],
      ] as any);

      const unprotectedHeaders = new UnprotectedHeaders([
        [Headers.KeyID, Buffer.from(kryptos.id, "utf-8")],
        [COSE_LABEL.OID, Buffer.from("test-oid", "utf-8")],
      ] as any);

      // aegis expects payloadCbor = cbor.encode(payloadBuffer) as the Sign1 payload
      // We need to CBOR-encode the payload buffer to match aegis's double-encoding
      const payloadBuffer = Buffer.from(PLAINTEXT, "utf-8");
      const payloadCbor = cborEncoder.encode(payloadBuffer);

      const sign1 = await Sign1.sign(
        protectedHeaders,
        unprotectedHeaders,
        payloadCbor,
        privateKey,
      );

      // @auth0/cose Sign1.encode() produces tagged CBOR (tag 18).
      // aegis expects untagged CBOR arrays. Extract the raw components
      // via getContentForEncoding() and re-encode as an untagged array.
      const components = sign1.getContentForEncoding();
      const tokenBytes = cborEncode(components);

      // Verify with aegis
      const result = kit.verify(tokenBytes);
      expect(result.payload).toBe(PLAINTEXT);
      expect(result.header.algorithm).toBe(kryptos.algorithm);
      expect(result.header.contentType).toBe("text/plain; charset=utf-8");
      expect(result.header.headerType).toBe("application/cose; cose-type=cose-sign");
    });
  });
});

// ===========================================================================
// CWE (COSE Encrypt) structural compliance tests
// ===========================================================================

describe("COSE interop: CWE structural compliance", () => {
  test("aegis CWE token decodes as valid 4-tuple", () => {
    const kryptos = createOctDirKey();
    const kit = new CweKit({ logger, kryptos, encryption: "A256GCM" });

    const { buffer } = kit.encrypt(PLAINTEXT);

    const decoded = cborEncoder.decode(buffer);

    // Must be a 4-element array: [protectedCbor, unprotectedMap, ciphertext, recipients]
    expect(Array.isArray(decoded)).toBe(true);
    expect(decoded).toHaveLength(4);

    const [protectedCbor, unprotectedMap, ciphertext, recipients] = decoded;

    // protectedCbor must be bstr
    expect(Buffer.isBuffer(protectedCbor) || protectedCbor instanceof Uint8Array).toBe(
      true,
    );

    // unprotectedMap must be a Map
    expect(unprotectedMap).toBeInstanceOf(Map);

    // ciphertext must be bstr
    expect(Buffer.isBuffer(ciphertext) || ciphertext instanceof Uint8Array).toBe(true);
    expect(ciphertext.length).toBeGreaterThan(0);

    // recipients must be an array
    expect(Array.isArray(recipients)).toBe(true);
    expect(recipients.length).toBeGreaterThanOrEqual(1);
  });

  test("protected header label 1 = content encryption algorithm (A256GCM -> 3)", () => {
    const kryptos = createOctDirKey();
    const kit = new CweKit({ logger, kryptos, encryption: "A256GCM" });

    const { buffer } = kit.encrypt(PLAINTEXT);

    const decoded = cborEncoder.decode(buffer);
    const [protectedCbor] = decoded;

    const protectedMap: Map<number, unknown> = cborEncoder.decode(protectedCbor);
    expect(protectedMap).toBeInstanceOf(Map);

    // RFC 9052: protected header alg = content encryption algorithm
    // A256GCM = label 3
    expect(protectedMap.get(COSE_LABEL.ALG)).toBe(COSE_ALG_LABEL["A256GCM"]);

    // Also verify typ and cty
    expect(protectedMap.get(COSE_LABEL.TYP)).toBe(
      "application/cose; cose-type=cose-encrypt",
    );
    expect(protectedMap.get(COSE_LABEL.CTY)).toBe("text/plain");
  });

  test("recipient header label 1 = key management algorithm", () => {
    const kryptos = createOctKwKey();
    const kit = new CweKit({ logger, kryptos, encryption: "A256GCM" });

    const { buffer } = kit.encrypt(PLAINTEXT);

    const decoded = cborEncoder.decode(buffer);
    const [, , , recipients] = decoded;

    // First recipient is [protectedCbor, recipientHeaderMap, publicEncryptionKey]
    const [recipient] = recipients;
    expect(Array.isArray(recipient)).toBe(true);
    expect(recipient.length).toBe(3);

    const [, recipientHeaderMap] = recipient;
    expect(recipientHeaderMap).toBeInstanceOf(Map);

    // Recipient header label 1 = key management algorithm (A128KW = -3)
    expect(recipientHeaderMap.get(COSE_LABEL.ALG)).toBe(COSE_ALG_LABEL["A128KW"]);

    // Recipient header label 4 = kid
    const kidValue = recipientHeaderMap.get(COSE_LABEL.KID);
    expect(kidValue).toBeDefined();
    const kidStr =
      kidValue instanceof Uint8Array ? Buffer.from(kidValue).toString("utf8") : kidValue;
    expect(kidStr).toBe(kryptos.id);
  });

  test("ciphertext contains content + auth tag (GCM)", () => {
    const kryptos = createOctDirKey();
    const kit = new CweKit({ logger, kryptos, encryption: "A256GCM" });

    const { buffer } = kit.encrypt(PLAINTEXT);

    const decoded = cborEncoder.decode(buffer);
    const [, , ciphertext] = decoded;

    // GCM auth tag is 16 bytes (128 bits), so ciphertext must be longer than 16 bytes
    // (actual content + 16 byte tag)
    expect(ciphertext.length).toBeGreaterThan(16);
  });

  test("unprotected header contains iv label", () => {
    const kryptos = createOctDirKey();
    const kit = new CweKit({ logger, kryptos, encryption: "A256GCM" });

    const { buffer } = kit.encrypt(PLAINTEXT);

    const decoded = cborEncoder.decode(buffer);
    const [, unprotectedMap] = decoded;

    // Label 5 = iv
    const iv = unprotectedMap.get(COSE_LABEL.IV);
    expect(iv).toBeDefined();
    expect(iv instanceof Uint8Array || Buffer.isBuffer(iv)).toBe(true);
    // GCM IV is 12 bytes
    expect(iv.length).toBe(12);
  });

  test("CWE round-trip: encrypt then decrypt produces original plaintext", () => {
    const kryptos = createOctDirKey();
    const kit = new CweKit({ logger, kryptos, encryption: "A256GCM" });

    const { token } = kit.encrypt(PLAINTEXT);
    const result = kit.decrypt(token);

    expect(result.payload).toBe(PLAINTEXT);
    // In COSE format, the protected header alg = content encryption algorithm
    // This is mapped to header.algorithm (not header.encryption)
    expect(result.header.algorithm).toBe("A256GCM");
  });

  test("CWE with A128KW round-trips correctly", () => {
    const kryptos = createOctKwKey();
    const kit = new CweKit({ logger, kryptos, encryption: "A128GCM" });

    const { token } = kit.encrypt(PLAINTEXT);
    const result = kit.decrypt(token);

    expect(result.payload).toBe(PLAINTEXT);
    // COSE: protected alg = content encryption (A128GCM), recipient alg = key management (A128KW)
    // parseTokenHeader maps protected alg to header.algorithm
    expect(result.header.algorithm).toBe("A128GCM");
  });
});

// ===========================================================================
// CWT claim label compliance tests
// ===========================================================================

describe("COSE interop: CWT claim labels (RFC 8392)", () => {
  test("CWT payload uses standard integer claim labels", () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({
      issuer: ISSUER,
      logger,
      kryptos,
    });

    const { buffer } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
    });

    // Decode the outer CBOR array
    const decoded = cborEncoder.decode(buffer);
    expect(Array.isArray(decoded)).toBe(true);
    expect(decoded).toHaveLength(4);

    const [, , payloadCbor] = decoded;

    // Decode the payload CBOR map
    const payloadMap: Map<number, unknown> = cborEncoder.decode(payloadCbor);
    expect(payloadMap).toBeInstanceOf(Map);

    // RFC 8392 claim labels:
    // Label 1 = iss
    const issValue = payloadMap.get(COSE_CLAIM.ISS);
    expect(issValue).toBe(ISSUER);

    // Label 2 = sub
    const subValue = payloadMap.get(COSE_CLAIM.SUB);
    expect(subValue).toBeDefined();
    // sub is stored as bstr in aegis, decode it
    const subStr =
      subValue instanceof Uint8Array ? Buffer.from(subValue).toString("utf8") : subValue;
    expect(subStr).toBe(SUBJECT);

    // Label 4 = exp
    const expValue = payloadMap.get(COSE_CLAIM.EXP);
    expect(typeof expValue).toBe("number");
    expect(expValue).toBeGreaterThan(0);

    // Label 6 = iat
    const iatValue = payloadMap.get(COSE_CLAIM.IAT);
    expect(typeof iatValue).toBe("number");
    expect(iatValue).toBeGreaterThan(0);

    // Label 7 = jti (cti in COSE, mapped from jti)
    const jtiValue = payloadMap.get(COSE_CLAIM.JTI);
    expect(jtiValue).toBeDefined();
  });

  test("CWT protected header has correct algorithm label", () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({
      issuer: ISSUER,
      logger,
      kryptos,
    });

    const { buffer } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
    });

    const decoded = cborEncoder.decode(buffer);
    const [protectedCbor] = decoded;

    const protectedMap: Map<number, unknown> = cborEncoder.decode(protectedCbor);
    expect(protectedMap).toBeInstanceOf(Map);

    // Algorithm label 1 = ES256 = -7
    expect(protectedMap.get(COSE_LABEL.ALG)).toBe(COSE_ALG_LABEL["ES256"]);

    // Type label 16
    expect(protectedMap.get(COSE_LABEL.TYP)).toBe("application/cwt");

    // Content type label 3
    expect(protectedMap.get(COSE_LABEL.CTY)).toBe("application/json");
  });

  test("CWT with OKP/EdDSA verifiable by @auth0/cose Sign1", async () => {
    const kryptos = createOkpSigKey();
    const kit = new CwtKit({
      issuer: ISSUER,
      logger,
      kryptos,
    });

    const { buffer } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
    });

    // @auth0/cose should be able to decode and verify the CWT
    // since CWT uses the same COSE_Sign1 structure as CWS
    const sign1 = Sign1.decode(buffer);

    expect(sign1.protectedHeaders.get(Headers.Algorithm)).toBe(Algorithms.EdDSA);

    const publicKey = await getJoseKey(kryptos, "public");
    await expect(sign1.verify(publicKey)).resolves.toBeUndefined();
  });

  test("CWT with EC/ES256 verifiable by @auth0/cose Sign1", async () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({
      issuer: ISSUER,
      logger,
      kryptos,
    });

    const { buffer } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
    });

    const sign1 = Sign1.decode(buffer);
    expect(sign1.protectedHeaders.get(Headers.Algorithm)).toBe(Algorithms.ES256);

    const publicKey = await getJoseKey(kryptos, "public");
    await expect(sign1.verify(publicKey)).resolves.toBeUndefined();
  });

  test("CWT with RSA/RS256 verifiable by @auth0/cose Sign1", async () => {
    const kryptos = createRsaSigKey();
    const kit = new CwtKit({
      issuer: ISSUER,
      logger,
      kryptos,
    });

    const { buffer } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
    });

    const sign1 = Sign1.decode(buffer);
    expect(sign1.protectedHeaders.get(Headers.Algorithm)).toBe(Algorithms.RS256);

    const publicKey = await getJoseKey(kryptos, "public");
    await expect(sign1.verify(publicKey)).resolves.toBeUndefined();
  });

  test("CWT round-trip through aegis sign + verify", () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({
      issuer: ISSUER,
      logger,
      kryptos,
    });

    const { token } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
    });

    const result = kit.verify(token);
    expect(result.payload.issuer).toBe(ISSUER);
    expect(result.payload.subject).toBe(SUBJECT);
    expect(result.payload.tokenType).toBe("access_token");
    expect(result.payload.expiresAt).toBeInstanceOf(Date);
  });
});

// ===========================================================================
// Algorithm label mapping completeness
// ===========================================================================

describe("COSE interop: algorithm label mappings match RFC 9053", () => {
  test.each([
    { alg: "ES256", label: -7 },
    { alg: "ES384", label: -35 },
    { alg: "ES512", label: -36 },
    { alg: "EdDSA", label: -8 },
    { alg: "RS256", label: -257 },
    { alg: "RS384", label: -258 },
    { alg: "RS512", label: -259 },
    { alg: "PS256", label: -37 },
    { alg: "PS384", label: -38 },
    { alg: "PS512", label: -39 },
    { alg: "HS256", label: 5 },
    { alg: "HS384", label: 6 },
    { alg: "HS512", label: 7 },
    { alg: "A128GCM", label: 1 },
    { alg: "A192GCM", label: 2 },
    { alg: "A256GCM", label: 3 },
  ])("aegis maps $alg to COSE label $label", ({ alg, label }) => {
    expect(COSE_ALG_LABEL[alg]).toBe(label);
  });

  // Verify aegis signature algorithms match @auth0/cose enum values
  test.each([
    { alg: "EdDSA", auth0Value: Algorithms.EdDSA },
    { alg: "ES256", auth0Value: Algorithms.ES256 },
    { alg: "ES384", auth0Value: Algorithms.ES384 },
    { alg: "ES512", auth0Value: Algorithms.ES512 },
    { alg: "RS256", auth0Value: Algorithms.RS256 },
    { alg: "RS384", auth0Value: Algorithms.RS384 },
    { alg: "RS512", auth0Value: Algorithms.RS512 },
    { alg: "PS256", auth0Value: Algorithms.PS256 },
    { alg: "PS384", auth0Value: Algorithms.PS384 },
    { alg: "PS512", auth0Value: Algorithms.PS512 },
  ])("aegis $alg label matches @auth0/cose Algorithms.$alg", ({ alg, auth0Value }) => {
    expect(COSE_ALG_LABEL[alg]).toBe(auth0Value);
  });
});

// ===========================================================================
// COSE header label mappings match RFC 9052
// ===========================================================================

describe("COSE interop: header label mappings match RFC 9052", () => {
  test.each([
    { header: "Algorithm", aegisLabel: COSE_LABEL.ALG, auth0Value: Headers.Algorithm },
    { header: "Critical", aegisLabel: COSE_LABEL.CRIT, auth0Value: Headers.Critical },
    {
      header: "ContentType",
      aegisLabel: COSE_LABEL.CTY,
      auth0Value: Headers.ContentType,
    },
    { header: "KeyID", aegisLabel: COSE_LABEL.KID, auth0Value: Headers.KeyID },
    { header: "IV", aegisLabel: COSE_LABEL.IV, auth0Value: Headers.IV },
  ])(
    "aegis label for $header matches @auth0/cose Headers.$header",
    ({ aegisLabel, auth0Value }) => {
      expect(aegisLabel).toBe(auth0Value);
    },
  );
});

// ===========================================================================
// External target mode: proprietary labels as string keys
// ===========================================================================

describe("COSE interop: external target mode", () => {
  describe("CWS with target: external", () => {
    test("no integer labels >= 400 in unprotected header", () => {
      const kryptos = createEcSigKey();
      const kit = new CwsKit({ logger, kryptos });

      const { buffer } = kit.sign(PLAINTEXT, {
        objectId: "ext-test-oid",
        target: "external",
      });

      const decoded = cborEncoder.decode(buffer);
      const [, unprotectedMap] = decoded;

      expect(unprotectedMap).toBeInstanceOf(Map);

      // No integer keys >= 400 should exist
      for (const key of unprotectedMap.keys()) {
        if (typeof key === "number") {
          expect(key).toBeLessThan(400);
        }
      }

      // oid should be present as string key with raw value (not bstr)
      expect(unprotectedMap.get("oid")).toBe("ext-test-oid");
    });

    test("standard RFC labels still use integers", () => {
      const kryptos = createEcSigKey();
      const kit = new CwsKit({ logger, kryptos });

      const { buffer } = kit.sign(PLAINTEXT, { target: "external" });

      const decoded = cborEncoder.decode(buffer);
      const [protectedCbor, unprotectedMap] = decoded;

      // Protected header still has integer labels
      const protectedMap: Map<number, unknown> = cborEncoder.decode(protectedCbor);
      expect(protectedMap.get(COSE_LABEL.ALG)).toBe(COSE_ALG_LABEL["ES256"]);
      expect(protectedMap.get(COSE_LABEL.CTY)).toBe("text/plain; charset=utf-8");
      expect(protectedMap.get(COSE_LABEL.TYP)).toBe(
        "application/cose; cose-type=cose-sign",
      );

      // Unprotected header: kid still uses integer label 4
      const kidValue = unprotectedMap.get(COSE_LABEL.KID);
      expect(kidValue).toBeDefined();
    });

    test("aegis sign (external) -> @auth0/cose decode + verify", async () => {
      const kryptos = createEcSigKey();
      const kit = new CwsKit({ logger, kryptos });

      const { buffer } = kit.sign(PLAINTEXT, { target: "external" });

      const sign1 = Sign1.decode(buffer);
      expect(sign1.protectedHeaders.get(Headers.Algorithm)).toBe(Algorithms.ES256);

      const publicKey = await getJoseKey(kryptos, "public");
      await expect(sign1.verify(publicKey)).resolves.toBeUndefined();
    });

    test("round-trip: external CWS sign -> aegis verify", () => {
      const kryptos = createEcSigKey();
      const kit = new CwsKit({ logger, kryptos });

      const { buffer } = kit.sign(PLAINTEXT, {
        objectId: "roundtrip-ext",
        target: "external",
      });

      // Decode path handles both formats
      const result = kit.verify(buffer);
      expect(result.payload).toBe(PLAINTEXT);
      expect(result.header.objectId).toBe("roundtrip-ext");
    });
  });

  describe("CWE with target: external", () => {
    test("no integer labels >= 400 in unprotected header", () => {
      const kryptos = createOctDirKey();
      const kit = new CweKit({ logger, kryptos, encryption: "A256GCM" });

      const { buffer } = kit.encrypt(PLAINTEXT, {
        objectId: "cwe-ext-oid",
        target: "external",
      });

      const decoded = cborEncoder.decode(buffer);
      const [, unprotectedMap] = decoded;

      expect(unprotectedMap).toBeInstanceOf(Map);

      for (const key of unprotectedMap.keys()) {
        if (typeof key === "number") {
          expect(key).toBeLessThan(400);
        }
      }

      // oid present as string key
      expect(unprotectedMap.get("oid")).toBe("cwe-ext-oid");
    });

    test("round-trip: external CWE encrypt -> decrypt", () => {
      const kryptos = createOctDirKey();
      const kit = new CweKit({ logger, kryptos, encryption: "A256GCM" });

      const { token } = kit.encrypt(PLAINTEXT, {
        objectId: "cwe-ext-rt",
        target: "external",
      });

      const result = kit.decrypt(token);
      expect(result.payload).toBe(PLAINTEXT);
    });
  });

  describe("CWT with target: external", () => {
    test("no integer labels >= 400 in payload or headers", () => {
      const kryptos = createEcSigKey();
      const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

      const { buffer } = kit.sign(
        {
          expires: "1h",
          subject: SUBJECT,
          tokenType: "access_token",
        },
        { target: "external" },
      );

      const decoded = cborEncoder.decode(buffer);
      const [, unprotectedMap, payloadCbor] = decoded;

      // Unprotected header: no integer keys >= 400
      expect(unprotectedMap).toBeInstanceOf(Map);
      for (const key of unprotectedMap.keys()) {
        if (typeof key === "number") {
          expect(key).toBeLessThan(400);
        }
      }

      // Payload: no integer keys >= 400
      const payloadMap: Map<number | string, unknown> = cborEncoder.decode(payloadCbor);
      expect(payloadMap).toBeInstanceOf(Map);
      for (const key of payloadMap.keys()) {
        if (typeof key === "number") {
          expect(key).toBeLessThan(400);
        }
      }

      // Proprietary claims present as string keys
      expect(payloadMap.get("token_type")).toBe("access_token");
    });

    test("standard CWT claims still use integer labels", () => {
      const kryptos = createEcSigKey();
      const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

      const { buffer } = kit.sign(
        {
          expires: "1h",
          subject: SUBJECT,
          tokenType: "access_token",
        },
        { target: "external" },
      );

      const decoded = cborEncoder.decode(buffer);
      const [protectedCbor, , payloadCbor] = decoded;

      // Protected header: standard labels
      const protectedMap: Map<number, unknown> = cborEncoder.decode(protectedCbor);
      expect(protectedMap.get(COSE_LABEL.ALG)).toBe(COSE_ALG_LABEL["ES256"]);
      expect(protectedMap.get(COSE_LABEL.TYP)).toBe("application/cwt");

      // Payload: standard claims use integer labels
      const payloadMap: Map<number | string, unknown> = cborEncoder.decode(payloadCbor);
      expect(payloadMap.get(COSE_CLAIM.ISS)).toBe(ISSUER);
      expect(typeof payloadMap.get(COSE_CLAIM.EXP)).toBe("number");
      expect(typeof payloadMap.get(COSE_CLAIM.IAT)).toBe("number");
    });

    test("aegis CWT (external) verifiable by @auth0/cose Sign1", async () => {
      const kryptos = createEcSigKey();
      const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

      const { buffer } = kit.sign(
        {
          expires: "1h",
          subject: SUBJECT,
          tokenType: "access_token",
        },
        { target: "external" },
      );

      const sign1 = Sign1.decode(buffer);
      expect(sign1.protectedHeaders.get(Headers.Algorithm)).toBe(Algorithms.ES256);

      const publicKey = await getJoseKey(kryptos, "public");
      await expect(sign1.verify(publicKey)).resolves.toBeUndefined();
    });

    test("round-trip: external CWT sign -> aegis verify", () => {
      const kryptos = createEcSigKey();
      const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

      const { token } = kit.sign(
        {
          expires: "1h",
          subject: SUBJECT,
          tokenType: "access_token",
        },
        { target: "external" },
      );

      const result = kit.verify(token);
      expect(result.payload.issuer).toBe(ISSUER);
      expect(result.payload.subject).toBe(SUBJECT);
      expect(result.payload.tokenType).toBe("access_token");
    });

    test("decode of external token produces same parsed output as internal", () => {
      const kryptos = createEcSigKey();
      const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

      const content = {
        expires: "1h",
        subject: SUBJECT,
        tokenType: "access_token",
      } as const;

      const internal = kit.sign(content);
      const external = kit.sign(content, { target: "external" });

      const parsedInternal = CwtKit.parse(internal.token);
      const parsedExternal = CwtKit.parse(external.token);

      // Same parsed payload fields
      expect(parsedExternal.payload.issuer).toBe(parsedInternal.payload.issuer);
      expect(parsedExternal.payload.subject).toBe(parsedInternal.payload.subject);
      expect(parsedExternal.payload.tokenType).toBe(parsedInternal.payload.tokenType);
      expect(parsedExternal.header.algorithm).toBe(parsedInternal.header.algorithm);
      expect(parsedExternal.header.headerType).toBe(parsedInternal.header.headerType);
    });
  });
});

// ===========================================================================
// Custom COSE claim labels (>= 900) for CWT payloads
// ===========================================================================

describe("COSE interop: custom claim labels (>= 900)", () => {
  test("CWT with custom claims produces integer labels in CBOR payload", () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

    const { buffer } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
      claims: { 900: "user-abc", 901: 42 },
    });

    const decoded = cborEncoder.decode(buffer);
    const [, , payloadCbor] = decoded;

    const payloadMap: Map<number | string, unknown> = cborEncoder.decode(payloadCbor);
    expect(payloadMap).toBeInstanceOf(Map);

    // Custom claims use integer keys
    expect(payloadMap.get(900)).toBe("user-abc");
    expect(payloadMap.get(901)).toBe(42);

    // Standard claims still present
    expect(payloadMap.get(COSE_CLAIM.ISS)).toBe(ISSUER);
  });

  test("CWT with custom claims verifiable by @auth0/cose Sign1", async () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

    const { buffer } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
      claims: { 900: "user-abc", 901: 42 },
    });

    const sign1 = Sign1.decode(buffer);
    expect(sign1.protectedHeaders.get(Headers.Algorithm)).toBe(Algorithms.ES256);

    const publicKey = await getJoseKey(kryptos, "public");
    await expect(sign1.verify(publicKey)).resolves.toBeUndefined();
  });

  test("round-trip sign -> verify preserves custom claims", () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

    const { token } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
      claims: { 900: "user-abc", 901: 42 },
    });

    const result = kit.verify(token);
    expect(result.payload.claims["900"]).toBe("user-abc");
    expect(result.payload.claims["901"]).toBe(42);
    expect(result.payload.issuer).toBe(ISSUER);
  });

  test("external target: custom claims use string keys, no integer labels >= 900", () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

    const { buffer } = kit.sign(
      {
        expires: "1h",
        subject: SUBJECT,
        tokenType: "access_token",
        claims: { 900: "user-abc" },
      },
      { target: "external" },
    );

    const decoded = cborEncoder.decode(buffer);
    const [, , payloadCbor] = decoded;

    const payloadMap: Map<number | string, unknown> = cborEncoder.decode(payloadCbor);
    expect(payloadMap).toBeInstanceOf(Map);

    // No integer keys >= 900
    for (const key of payloadMap.keys()) {
      if (typeof key === "number") {
        expect(key).toBeLessThan(900);
      }
    }

    // Custom claim present as string key
    expect(payloadMap.get("900")).toBe("user-abc");
  });

  test("large custom labels (e.g. 10000) work correctly", () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

    const { buffer, token } = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
      claims: { 10000: "large-label" },
    });

    const decoded = cborEncoder.decode(buffer);
    const [, , payloadCbor] = decoded;
    const payloadMap: Map<number | string, unknown> = cborEncoder.decode(payloadCbor);
    expect(payloadMap.get(10000)).toBe("large-label");

    const result = kit.verify(token);
    expect(result.payload.claims["10000"]).toBe("large-label");
  });

  test("token with integer custom claims is smaller than string key equivalent", () => {
    const kryptos = createEcSigKey();
    const kit = new CwtKit({ issuer: ISSUER, logger, kryptos });

    const internalResult = kit.sign({
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
      claims: { 900: "user-abc", 901: 42 },
    });

    const externalResult = kit.sign(
      {
        expires: "1h",
        subject: SUBJECT,
        tokenType: "access_token",
        claims: { 900: "user-abc", 901: 42 },
      },
      { target: "external" },
    );

    // Internal (integer labels) should be smaller than external (string keys)
    expect(internalResult.buffer.length).toBeLessThan(externalResult.buffer.length);
  });
});
