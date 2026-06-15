import {
  Algorithms,
  COSEKey,
  Headers,
  ProtectedHeaders,
  Sign1,
  UnprotectedHeaders,
} from "@auth0/cose";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { IKryptos } from "@lindorm/kryptos";
import coseJs from "cose-js";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OKP_KEY_SIG } from "../__fixtures__/keys.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { decodeCwtClaims, encodeCwtClaims } from "../internal/cose/cwt-claims.js";
import { COSE_TAG } from "../internal/cose/structures.js";
import { CwtKit } from "./CwtKit.js";

const logger = createMockLogger();

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
      const token = new CwtKit({ kryptos, logger }).sign(common);
      const sign1 = Sign1.decode(toBareSign1(token));

      await expect(
        sign1.verify(await toKeyLike(kryptos, "public"), { algorithms: [alg] }),
      ).resolves.toBeUndefined();

      // …and the verified payload decodes back to our domain claims.
      const claims = decodeCwtClaims(
        decodeCbor<Map<unknown, unknown>>(Buffer.from(sign1.payload), {
          preferMap: false,
        }),
      );
      expect(claims).toEqual(common);
    });
  });

  describe("an @auth0/cose COSE_Sign1 verifies in our CwtKit", () => {
    test.each(cases)("$name", async ({ kryptos, alg }) => {
      const payload = Buffer.from(encodeCbor(encodeCwtClaims(common)));

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

      const { claims } = new CwtKit({ kryptos, logger }).verify(cwt);
      expect(claims).toEqual(common);
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
    const token = new CwtKit({ kryptos, logger }).sign(common);

    // cose-js returns the verified payload (or throws on a bad signature).
    const payload = await coseJs.sign.verify(
      toBareSign1(token),
      ecRawKey(kryptos, "public"),
    );

    const claims = decodeCwtClaims(
      decodeCbor<Map<unknown, unknown>>(Buffer.from(payload), { preferMap: false }),
    );
    expect(claims).toEqual(common);
  });

  test("a cose-js COSE_Sign1 verifies in our CwtKit", async () => {
    const payload = Buffer.from(encodeCbor(encodeCwtClaims(common)));

    // A single signer object (not an array) makes cose-js emit a COSE_Sign1.
    const bare = await coseJs.sign.create(
      { p: { alg: "ES512" }, u: { kid: Buffer.from(kryptos.id, "utf8") } },
      payload,
      ecRawKey(kryptos, "private"),
    );

    const cwt = Buffer.from(encodeCbor(new Tag(COSE_TAG.cwt, decodeCbor(bare))));

    const { claims } = new CwtKit({ kryptos, logger }).verify(cwt);
    expect(claims).toEqual(common);
  });
});

// A token exercising EVERY strand of our custom claim logic: proprietary
// private-use labels (loa, tenantId), the compact integer-keyed structured
// claims (act, sub_id), an OIDC hash as a byte string, a cnf, a passthrough
// array (RFC 9396) and an unknown custom claim.
const AT_HASH = "LXEWQrcmsEQBYnyp-6wy9chTD7GQPMTbAiWHF5IaSIE"; // 32-byte b64url
const fullCommon = {
  ...common,
  levelOfAssurance: 3, // proprietary private-use label (-65537)
  tenantId: "tenant-7", // proprietary private-use label (-65541)
  accessTokenHash: AT_HASH, // bstr
  act: { subject: "actor", issuer: "https://delegator/", clientId: "c-2" }, // compact map
  subjectId: { format: "iss_sub", iss: "https://i/", sub: "u" }, // compact map
  authorizationDetails: [{ type: "payment" }], // string-keyed passthrough
  confirmation: { keyId: "proof-key-1" }, // cnf (RFC 8747)
  token_introspection: { active: true }, // unknown custom claim
};

describe("COSE interop — custom logic does not break the token", () => {
  // The CWT payload is opaque to the COSE layer, so a reference verifier need
  // not understand our proprietary claims — it must only NOT throw: verify the
  // signature, decode the envelope, and hand back the opaque payload. The
  // payload stays well-formed CBOR with the standard labels intact.
  test("our full proprietary CWT verifies in @auth0/cose without throwing", async () => {
    const token = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(fullCommon);
    const sign1 = Sign1.decode(toBareSign1(token));

    await expect(
      sign1.verify(await toKeyLike(TEST_EC_KEY_SIG, "public"), {
        algorithms: [Algorithms.ES512],
      }),
    ).resolves.toBeUndefined();

    const map = decodeCbor<Map<unknown, unknown>>(Buffer.from(sign1.payload));
    expect(map.get(1)).toBe(fullCommon.issuer); // iss still readable
    expect(map.get(2)).toBe(fullCommon.subject); // sub still readable
    expect(map.get(-65537)).toBe(3); // loa — opaque private-use label, still valid CBOR
    expect(map.get("act")).toBeInstanceOf(Map); // compact act — a valid CBOR sub-map

    // …and the whole thing still round-trips losslessly on our side.
    expect(new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).verify(token).claims).toEqual(
      fullCommon,
    );
  });

  test("our full proprietary CWT verifies in cose-js without throwing", async () => {
    const token = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(fullCommon);
    await expect(
      coseJs.sign.verify(toBareSign1(token), ecRawKey(TEST_EC_KEY_SIG, "public")),
    ).resolves.toBeDefined();
  });

  test("a reference-signed COSE_Sign1 over our proprietary payload round-trips in us", async () => {
    const payload = Buffer.from(encodeCbor(encodeCwtClaims(fullCommon)));

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

    expect(new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).verify(cwt).claims).toEqual(
      fullCommon,
    );
  });

  test("proprietary:false yields an interoperable payload that still verifies", async () => {
    const token = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(fullCommon, {
      proprietary: false,
    });
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
    expect(map.has(-65537)).toBe(false); // loa dropped (no interoperable form)
    expect(map.has(-65541)).toBe(false); // tenantId dropped
    expect(map.get("act")).toEqual(fullCommon.act); // act is now a string-keyed object
    expect(map.get("sub_id")).toEqual(fullCommon.subjectId); // sub_id too
  });
});
