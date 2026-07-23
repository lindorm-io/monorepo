import {
  Algorithms,
  COSEKey,
  Headers,
  ProtectedHeaders,
  Sign1,
  UnprotectedHeaders,
} from "@auth0/cose";
import { B64 } from "@lindorm/b64";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { IKryptos } from "@lindorm/kryptos";
import coseJs from "cose-js";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import type { Dict } from "@lindorm/types";
import { TEST_EC_KEY_SIG, TEST_OKP_KEY_SIG } from "../__fixtures__/keys.js";
import { coseToDomain, domainToCose } from "../internal/claims/translate.js";
import { algToCoseLabel } from "../internal/cose/alg-labels.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import {
  decodeCwtClaims,
  type EncodeCwtOptions,
  encodeCwtClaims,
} from "../internal/cose/cwt-claims.js";
import { COSE_TAG, encodeProtectedHeader } from "../internal/cose/structures.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { CwtKit } from "./CwtKit.js";

// Between the fixtures' issuedAt (1700000000) and expiresAt (1700003600), so the
// in-kit temporal check (Phase 9 R10) accepts the round-tripped tokens.
MockDate.set(new Date(1700001000 * 1000));

const logger = createMockLogger();

// Since Phase 5 `encodeCwtClaims`/`decodeCwtClaims` are the CODEC boundary; the
// domain <-> wire translation is `domainToCose`/`coseToDomain`. These helpers
// exercise the full domain round-trip the reference verifiers sit inside.
const encodeClaims = (common: Dict, options?: EncodeCwtOptions) =>
  encodeCwtClaims(domainToCose(common), options);

const decodeClaims = (map: Map<unknown, unknown> | Dict): Dict => {
  const { claims, custom } = coseToDomain(decodeCwtClaims(map));
  return { ...claims, ...custom };
};

// The kit is WIRE-ONLY now: it takes/returns COSE-name-keyed claims. These
// helpers put the domain⇆wire translation (the Aegis-side signCose/verifyCose
// boundary) around it so the interop fixtures stay expressed in domain terms.
const signDomain = (kryptos: IKryptos, common: Dict, options: Dict = {}): Buffer =>
  new CwtKit({ kryptos, logger }).sign(domainToCose(common), options);

const verifyDomain = (kryptos: IKryptos, cwt: Buffer): Dict => {
  const { payload } = new CwtKit({ kryptos, logger }).verify(cwt);
  const { claims: domain, custom } = coseToDomain(payload);
  return { ...domain, ...custom };
};

// Only registered / interoperable claims — no lindorm-proprietary ones — so the
// round-trip is apples-to-apples with what a stock COSE/CWT verifier decodes.
const common = {
  issuer: "https://issuer.lindorm.io/",
  subject: "user-1",
  audience: ["https://rs.lindorm.io/"],
  expiresAt: new Date(1700003600 * 1000),
  issuedAt: new Date(1700000000 * 1000),
  tokenId: "the-jti",
  clientId: "client-1",
  scope: ["read", "write"],
};

// Our CWT is `Tag(61, Tag(18, [...]))`; `@auth0/cose` decodes a bare COSE_Sign1
// (tag 18). Strip the outer CWT tag and re-encode the Sign1.
const toBareSign1 = (cwt: Buffer): Buffer => {
  const outer = decodeCbor<Tag>(cwt);
  const sign1 =
    outer instanceof Tag && outer.tag === COSE_TAG.cwt ? outer.contents : outer;
  return Buffer.from(encodeCbor(sign1));
};

// Build the minimal standard JWK `@auth0/cose` understands from a kryptos.
const toKeyLike = (kryptos: IKryptos, mode: "public" | "private") => {
  const jwk = kryptos.export("jwk") as Record<string, unknown>;
  const { kty, crv, x, y, n, e, k, alg, d } = jwk;
  const clean: Record<string, unknown> = { kty, crv, x, y, n, e, k, alg };
  if (mode === "private") clean.d = d;
  for (const key of Object.keys(clean)) if (clean[key] === undefined) delete clean[key];
  return COSEKey.fromJWK(clean as never).toKeyLike();
};

describe("COSE interop — @auth0/cose", () => {
  const cases: Array<{ name: string; kryptos: IKryptos; alg: Algorithms }> = [
    { name: "EC / ES512", kryptos: TEST_EC_KEY_SIG, alg: Algorithms.ES512 },
    { name: "OKP / EdDSA", kryptos: TEST_OKP_KEY_SIG, alg: Algorithms.EdDSA },
  ];

  describe("our CWT verifies in @auth0/cose", () => {
    test.each(cases)("$name", async ({ kryptos, alg }) => {
      const token = signDomain(kryptos, common);
      const sign1 = Sign1.decode(toBareSign1(token));

      await expect(
        sign1.verify(await toKeyLike(kryptos, "public"), { algorithms: [alg] }),
      ).resolves.toBeUndefined();

      // …and the verified payload decodes back to our domain claims.
      const claims = decodeClaims(
        decodeCbor<Map<unknown, unknown>>(Buffer.from(sign1.payload), {
          preferMap: false,
        }),
      );
      expect(claims).toEqual(common);
    });
  });

  test("tolerates a proprietary CWT typ (application/at+cwt) without throwing", async () => {
    const token = signDomain(TEST_EC_KEY_SIG, common, {
      tokenType: "at",
    });

    // Our mint stamped the full CWT media type…
    expect(CwtKit.decode(token).typ).toBe("application/at+cwt");

    // …and @auth0/cose still verifies it WITHOUT throwing: RFC 9596 says the
    // typ is passed through to the application, never validated by the library.
    const sign1 = Sign1.decode(toBareSign1(token));
    await expect(
      sign1.verify(await toKeyLike(TEST_EC_KEY_SIG, "public"), {
        algorithms: [Algorithms.ES512],
      }),
    ).resolves.toBeUndefined();
  });

  describe("an @auth0/cose COSE_Sign1 verifies in our CwtKit", () => {
    test.each(cases)("$name", async ({ kryptos, alg }) => {
      const payload = Buffer.from(encodeCbor(encodeClaims(common)));

      const sign1 = await Sign1.sign(
        new ProtectedHeaders([[Headers.Algorithm, alg]]),
        new UnprotectedHeaders([[Headers.KeyID, Buffer.from(kryptos.id, "utf8")]]),
        payload,
        await toKeyLike(kryptos, "private"),
      );

      // Re-frame their Sign1 as our `Tag(61, Tag(18, [...]))` CWT.
      const cwt = Buffer.from(
        encodeCbor(
          new Tag(COSE_TAG.cwt, new Tag(COSE_TAG.sign1, sign1.getContentForEncoding())),
        ),
      );

      expect(verifyDomain(kryptos, cwt)).toEqual(common);
    });
  });
});

// cose-js (erdtman) is ECDSA/RSA/HMAC only — no EdDSA — so the EC key is used.
const ecRawKey = (kryptos: IKryptos, mode: "public" | "private") => {
  const jwk = kryptos.export("jwk") as { x?: string; y?: string; d?: string };
  return mode === "private"
    ? { key: { d: Buffer.from(jwk.d!, "base64url") } }
    : {
        key: { x: Buffer.from(jwk.x!, "base64url"), y: Buffer.from(jwk.y!, "base64url") },
      };
};

describe("COSE interop — cose-js", () => {
  const kryptos = TEST_EC_KEY_SIG; // ES512 / P-521

  test("our CWT verifies in cose-js", async () => {
    const token = signDomain(kryptos, common);

    // cose-js returns the verified payload (or throws on a bad signature).
    const payload = await coseJs.sign.verify(
      toBareSign1(token),
      ecRawKey(kryptos, "public"),
    );

    const claims = decodeClaims(
      decodeCbor<Map<unknown, unknown>>(Buffer.from(payload), { preferMap: false }),
    );
    expect(claims).toEqual(common);
  });

  test("a cose-js COSE_Sign1 verifies in our CwtKit", async () => {
    const payload = Buffer.from(encodeCbor(encodeClaims(common)));

    // A single signer object (not an array) makes cose-js emit a COSE_Sign1.
    const bare = await coseJs.sign.create(
      { p: { alg: "ES512" }, u: { kid: Buffer.from(kryptos.id, "utf8") } },
      payload,
      ecRawKey(kryptos, "private"),
    );

    const cwt = Buffer.from(encodeCbor(new Tag(COSE_TAG.cwt, decodeCbor(bare))));

    expect(verifyDomain(kryptos, cwt)).toEqual(common);
  });
});

// A token exercising EVERY strand of our custom claim logic: a string-keyed
// standards-based assurance level (loa), a proprietary private-use label
// (tenantId), the compact integer-keyed structured claims (act, sub_id), an
// OIDC hash as a byte string, a cnf, a passthrough array (RFC 9396) and an
// unknown custom claim.
const AT_HASH = "LXEWQrcmsEQBYnyp-6wy9chTD7GQPMTbAiWHF5IaSIE"; // 32-byte b64url
const fullCommon = {
  ...common,
  levelOfAssurance: 3, // standards-based, short name -> string-keyed ("loa")
  tenantId: "tenant-7", // private-use label P(14) = -65551
  accessTokenHash: AT_HASH, // bstr, private-use label P(0) = -65537
  act: { subject: "actor", issuer: "https://delegator/", clientId: "c-2" }, // compact map
  subjectId: { format: "iss_sub", iss: "https://i/", sub: "u" }, // compact map
  authorizationDetails: [{ type: "payment" }], // string-keyed passthrough
  confirmation: { keyId: "proof-key-1" }, // cnf (RFC 8747)
  token_introspection: { active: true }, // unknown custom claim
};

// What `CwtKit.verify` resolves for `fullCommon`: registered claims to their
// domain names, and — since Phase 5 converged COSE with the JOSE read path — the
// unknown `token_introspection` custom claim camelCased to `tokenIntrospection`.
const fullCommonDecoded = {
  ...common,
  levelOfAssurance: 3,
  tenantId: "tenant-7",
  accessTokenHash: AT_HASH,
  act: { subject: "actor", issuer: "https://delegator/", clientId: "c-2" },
  subjectId: { format: "iss_sub", iss: "https://i/", sub: "u" },
  authorizationDetails: [{ type: "payment" }],
  confirmation: { keyId: "proof-key-1" },
  tokenIntrospection: { active: true },
};

describe("COSE interop — custom logic does not break the token", () => {
  // The CWT payload is opaque to the COSE layer, so a reference verifier need
  // not understand our proprietary claims — it must only NOT throw: verify the
  // signature, decode the envelope, and hand back the opaque payload. The
  // payload stays well-formed CBOR with the standard labels intact.
  test("our full proprietary CWT verifies in @auth0/cose without throwing", async () => {
    // The compact private-use labels are the on-platform (proprietary) encoding.
    const token = signDomain(TEST_EC_KEY_SIG, fullCommon, { proprietary: true });
    const sign1 = Sign1.decode(toBareSign1(token));

    await expect(
      sign1.verify(await toKeyLike(TEST_EC_KEY_SIG, "public"), {
        algorithms: [Algorithms.ES512],
      }),
    ).resolves.toBeUndefined();

    const map = decodeCbor<Map<unknown, unknown>>(Buffer.from(sign1.payload));
    expect(map.get(1)).toBe(fullCommon.issuer); // iss still readable
    expect(map.get(2)).toBe(fullCommon.subject); // sub still readable
    expect(map.get("loa")).toBe(3); // loa — string-keyed standards-based claim
    expect(map.get(-65551)).toBe("tenant-7"); // tenantId — private-use label P(14)
    expect(map.get("act")).toBeInstanceOf(Map); // compact act — a valid CBOR sub-map

    // …and the whole thing still round-trips on our side (custom claim camelCased).
    expect(verifyDomain(TEST_EC_KEY_SIG, token)).toEqual(fullCommonDecoded);
  });

  test("our full proprietary CWT verifies in cose-js without throwing", async () => {
    const token = signDomain(TEST_EC_KEY_SIG, fullCommon, { proprietary: true });
    await expect(
      coseJs.sign.verify(toBareSign1(token), ecRawKey(TEST_EC_KEY_SIG, "public")),
    ).resolves.toBeDefined();
  });

  test("a reference-signed COSE_Sign1 over our proprietary payload round-trips in us", async () => {
    const payload = Buffer.from(
      encodeCbor(encodeClaims(fullCommon, { proprietary: true })),
    );

    const sign1 = await Sign1.sign(
      new ProtectedHeaders([[Headers.Algorithm, Algorithms.ES512]]),
      new UnprotectedHeaders([[Headers.KeyID, Buffer.from(TEST_EC_KEY_SIG.id, "utf8")]]),
      payload,
      await toKeyLike(TEST_EC_KEY_SIG, "private"),
    );
    const cwt = Buffer.from(
      encodeCbor(
        new Tag(COSE_TAG.cwt, new Tag(COSE_TAG.sign1, sign1.getContentForEncoding())),
      ),
    );

    expect(verifyDomain(TEST_EC_KEY_SIG, cwt)).toEqual(fullCommonDecoded);
  });

  test("proprietary:false yields an interoperable payload that still verifies", async () => {
    const token = signDomain(TEST_EC_KEY_SIG, fullCommon, { proprietary: false });
    const sign1 = Sign1.decode(toBareSign1(token));

    await expect(
      sign1.verify(await toKeyLike(TEST_EC_KEY_SIG, "public"), {
        algorithms: [Algorithms.ES512],
      }),
    ).resolves.toBeUndefined();

    // preferMap:false so the now string-keyed act/sub_id decode as objects; the
    // top map keeps its integer labels, so it stays a Map.
    const map = decodeCbor<Map<unknown, unknown>>(Buffer.from(sign1.payload), {
      preferMap: false,
    });
    // Nothing is dropped: loa stays string-keyed; tenantId degrades from its
    // private-use integer label to its JOSE string key.
    expect(map.get("loa")).toBe(3); // standards-based, string-keyed both ways
    expect(map.has(-65551)).toBe(false); // tenantId no longer integer-keyed
    expect(map.get("tenant_id")).toBe("tenant-7"); // degraded to JOSE string key, NOT dropped
    // act is now a string-keyed object carrying the RFC 8693 wire member names
    // (the translator's `act` shape) rather than the lindorm domain names.
    expect(map.get("act")).toEqual({
      sub: "actor",
      iss: "https://delegator/",
      client_id: "c-2",
    });
    expect(map.get("sub_id")).toEqual(fullCommon.subjectId); // sub_id too (already wire-shaped)
  });
});

// A FOREIGN COSE_Sign1 may carry protected-header parameters our own kits never
// emit (crit / x5chain / x5t CertHash). `decode` must shape each into the JOSE
// WIRE vocabulary, NOT leave the raw COSE structures on the header. These build a
// raw Sign1 by hand (labels our kits don't write) and decode it via `CwtKit`.
describe("COSE decode — foreign header parameters shape to the JOSE wire form", () => {
  const kit = () => new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

  // Wrap a hand-built COSE_Sign1 body ([protected, unprotected, payload, sig]) as
  // our `Tag(61, Tag(18, [...]))` CWT so `CwtKit.decode` reads it.
  const asCwt = (body: Array<unknown>): Buffer =>
    Buffer.from(encodeCbor(new Tag(COSE_TAG.cwt, new Tag(COSE_TAG.sign1, body))));

  const der1 = Buffer.from("308201aa30820192a0030201", "hex");
  const der2 = Buffer.from("308200bb30820188a0030202", "hex");

  const foreignBody = (protectedMap: Map<number, unknown>): Array<unknown> => [
    encodeProtectedHeader(protectedMap),
    new Map(),
    Buffer.from(encodeCbor(encodeClaims(common))),
    Buffer.alloc(0), // signature — decode never checks it
  ];

  test("crit label array decodes to JOSE wire-name strings (ints mapped, strings kept)", () => {
    const decoded = kit().decode(
      asCwt(
        foreignBody(
          new Map<number, unknown>([
            [coseByJose("alg"), algToCoseLabel("ES512")],
            // crit members: label 33 (x5c), label 3 (cty), and a bare string ext.
            [coseByJose("crit"), [33, 3, "custom-ext"]],
          ]),
        ),
      ),
    );

    expect(decoded.header.crit).toEqual(["x5c", "cty", "custom-ext"]);
  });

  test("x5chain bstr chain decodes to an Array<base64-string> (standard base64)", () => {
    const decoded = kit().decode(
      asCwt(
        foreignBody(
          new Map<number, unknown>([
            [coseByJose("alg"), algToCoseLabel("ES512")],
            [33, [der1, der2]], // x5chain — RFC 9360 label 33
          ]),
        ),
      ),
    );

    // Standard base64 (RFC 7515 §4.1.6), NOT base64url — matches JOSE x5c.
    expect(decoded.header.x5c).toEqual([B64.encode(der1), B64.encode(der2)]);
  });

  test("a single x5chain bstr (one cert) still decodes to a one-element Array", () => {
    const decoded = kit().decode(
      asCwt(
        foreignBody(
          new Map<number, unknown>([
            [coseByJose("alg"), algToCoseLabel("ES512")],
            [33, der1], // COSE allows a lone bstr for a single-cert chain
          ]),
        ),
      ),
    );

    expect(decoded.header.x5c).toEqual([B64.encode(der1)]);
  });

  test("x5t (label 34) is ABSENT — its COSE_CertHash has no faithful JOSE-wire form", () => {
    const decoded = kit().decode(
      asCwt(
        foreignBody(
          new Map<number, unknown>([
            [coseByJose("alg"), algToCoseLabel("ES512")],
            // COSE x5t is a CertHash `[algId, hashValue]`, structurally different
            // from JOSE's base64url thumbprint string — the registry leaves label
            // 34 unmapped, so decode SKIPS it rather than mis-shaping it.
            [34, [-16, Buffer.from("deadbeefcafe", "hex")]],
          ]),
        ),
      ),
    );

    expect(decoded.header.x5t).toBeUndefined();
  });

  test("a detached / nil payload is rejected with the clean Malformed CWT error", () => {
    const body: Array<unknown> = [
      encodeProtectedHeader(
        new Map<number, unknown>([[coseByJose("alg"), algToCoseLabel("ES512")]]),
      ),
      new Map(),
      null, // detached payload — legal COSE, but there are no claims to decode
      Buffer.alloc(0),
    ];

    expect(() => kit().decode(asCwt(body))).toThrow(/Malformed CWT/);
  });

  test("an aegis-minted CWT is unaffected — it emits none of these parameters", () => {
    const decoded = kit().decode(signDomain(TEST_EC_KEY_SIG, common));

    expect(decoded.header.crit).toBeUndefined();
    expect(decoded.header.x5c).toBeUndefined();
    expect(decoded.header.x5t).toBeUndefined();
    // …the standard parameters our kits DO emit are shaped as before.
    expect(decoded.header.alg).toBe("ES512");
    expect(decoded.header.kid).toBe(TEST_EC_KEY_SIG.id);
  });
});
