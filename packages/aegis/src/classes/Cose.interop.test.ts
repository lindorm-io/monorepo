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
