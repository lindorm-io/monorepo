import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_ENC,
  TEST_OKP_KEY_SIG,
} from "../__fixtures__/keys.js";
import { FAPI_SIG_ALGS } from "../constants/fapi.js";
import { AegisError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

/** A base64url JSON segment — a header or a claims payload. */
const seg = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/** A base64url segment over bytes that are NOT JSON — an opaque JWS body. */
const raw = (value: string): string => Buffer.from(value).toString("base64url");

const CLAIMS = seg({ iss: "https://issuer.test/", sub: "user_1" });

const jws = (header: unknown, payload = CLAIMS, signature = "sig"): string =>
  [seg(header), payload, signature].join(".");

const jwe = (header: unknown, tag = "tag"): string =>
  [seg(header), "key", "iv", "ciphertext", tag].join(".");

describe("Aegis", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: "https://test.lindorm.io/" }, logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TEST_EC_KEY_SIG);
    amphora.add(TEST_OKP_KEY_ENC);
  });

  // ⛔ THE ACCEPT/REJECT VERDICT MUST NOT TURN ON KEY ORDER. A raw hash source and
  // its digest claim are two spellings of one wire claim, so a verify handed both
  // could only check one — and which one it checked was decided by the order the
  // caller wrote them in, with the other silently discarded. The binding
  // `at_hash` exists to provide (OIDC Core §3.1.3.6) is what that discards.
  describe("a raw hash source presented beside its digest claim", () => {
    const ACCESS_TOKEN = "the-real-access-token";

    const mintWithHashes = () =>
      aegis.mint("default", {
        subject: "user-1",
        expires: "1h",
        tokenType: "test_token",
        accessToken: ACCESS_TOKEN,
      });

    test("should refuse the pair whichever way round the caller writes it", async () => {
      const { token } = await mintWithHashes();

      for (const assert of [
        { accessToken: ACCESS_TOKEN, accessTokenHash: "not-the-hash" },
        { accessTokenHash: "not-the-hash", accessToken: ACCESS_TOKEN },
      ]) {
        await expect(aegis.verify(token, assert), JSON.stringify(assert)).rejects.toThrow(
          expect.objectContaining({ code: "jwt_verify_conflicting_matchers" }),
        );
      }
    });

    // The CONTRAST that makes the refusal attributable to the PAIR: the same
    // token, the same false digest, stated alone — and it is refused for being
    // false rather than for colliding.
    test("should still refuse a digest that does not match, stated alone", async () => {
      const { token } = await mintWithHashes();

      await expect(
        aegis.verify(token, { accessTokenHash: "not-the-hash" }),
      ).rejects.toThrow(expect.objectContaining({ code: "claims_invalid" }));
    });

    test("should still accept the raw source that does hash to the claim, stated alone", async () => {
      const { token } = await mintWithHashes();

      await expect(
        aegis.verify(token, { accessToken: ACCESS_TOKEN }),
      ).resolves.toBeDefined();
    });
  });

  describe("an undefined member of a root operator", () => {
    const mint = () =>
      aegis.mint("default", {
        subject: "user-1",
        expires: "1h",
        tokenType: "test_token",
      });

    test("should place no constraint on verify", async () => {
      const { token } = await mint();

      await expect(
        aegis.verify(token, { $or: [undefined, { subject: "user-1" }] } as never),
      ).resolves.toEqual(
        expect.objectContaining({
          claims: expect.objectContaining({ subject: "user-1" }),
        }),
      );
    });

    test("should still enforce the members that are stated", async () => {
      const { token } = await mint();

      await expect(
        aegis.verify(token, { $or: [undefined, { subject: "other" }] } as never),
      ).rejects.toThrow(expect.objectContaining({ code: "claims_invalid" }));
    });
  });

  // The issuer aegis STAMPS is the service's own — amphora's `internal` scope,
  // which is the one reader of that setting. A verify-only deployment declares
  // none, and stamps none.
  describe("issuer", () => {
    test("should default to the amphora internal issuer", () => {
      expect(new Aegis({ amphora, logger }).issuer).toBe("https://test.lindorm.io/");
    });

    test("should prefer an explicitly configured issuer", () => {
      expect(
        new Aegis({ amphora, logger, issuer: "https://other.lindorm.io/" }).issuer,
      ).toBe("https://other.lindorm.io/");
    });

    test("should be null when the amphora declares no internal issuer", () => {
      expect(new Aegis({ amphora: new Amphora({ logger }), logger }).issuer).toBeNull();
    });
  });

  test("should sign and verify jwe", async () => {
    const res = await aegis.jwe.encrypt("data", {
      header: { oid: "33100373-9769-4389-94dd-1b1d738f0fc4" },
    });

    expect(res).toEqual({
      format: "jwe",
      token: expect.any(String),
    });

    await expect(aegis.jwe.decrypt(res.token)).resolves.toEqual({
      custom: { header: {} },
      header: {
        alg: "ECDH-ES",
        cty: "text/plain",
        enc: "A256GCM",
        epk: {
          crv: "X25519",
          kty: "OKP",
          x: expect.any(String),
        },
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        kid: "035f7f00-8101-5387-a935-e92f57347309",
        oid: "33100373-9769-4389-94dd-1b1d738f0fc4",
        typ: "JWE",
      },
      payload: "data",
      token: res.token,
    });
  });

  test("should sign and verify jws", async () => {
    const res = await aegis.jws.sign("data", {
      header: { oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc" },
    });

    expect(res).toEqual({
      format: "jws",
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
      token: expect.any(String),
    });

    await expect(aegis.jws.verify(res.token)).resolves.toEqual({
      custom: { header: {} },
      header: {
        alg: "ES512",
        cty: "text/plain",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
        typ: "JWS",
      },
      payload: "data",
      token: res.token,
    });
  });

  test("should sign and verify jwt", async () => {
    const res = await aegis.mint(
      "default",
      {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      },
      { sign: { header: { objectId: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad" } } },
    );

    expect(res).toEqual({
      expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      expiresIn: 3600,
      expiresOn: 1704099600,
      format: "jwt",
      objectId: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      token: expect.any(String),
      tokenId: expect.any(String),
    });

    await expect(aegis.jwt.verify(res.token)).resolves.toEqual({
      // The raw namespace returns the NATIVE WIRE shape: both `.header` (wire-named
      // `alg`/`kid`/`typ`) and `.payload` (wire-keyed `sub`/`exp`) — NOT the domain
      // header/buckets. The domain-named header + claims are `aegis.verify`.
      custom: { header: {} },
      header: {
        alg: "ES512",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        oid: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        typ: "application/test_token+jwt",
      },
      payload: {
        exp: 1704099600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jti: expect.any(String),
        nbf: 1704096000,
        sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      },
      token: res.token,
    });
  });

  test("should sign and verify jwe with jws", async () => {
    const jws = await aegis.jws.sign("data", {
      header: { oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc" },
    });

    const jwe = await aegis.jwe.encrypt(jws.token, {
      header: { oid: "33100373-9769-4389-94dd-1b1d738f0fc4" },
    });

    await expect(aegis.verify(jwe.token)).resolves.toEqual(
      expect.objectContaining({ format: "jws", wrapper: "jwe", raw: "data" }),
    );
  });

  test("should sign and verify jwe with jwt", async () => {
    const jwt = await aegis.mint("default", {
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    const jwe = await aegis.jwe.encrypt(jwt.token, {
      header: { oid: "33100373-9769-4389-94dd-1b1d738f0fc4" },
    });

    await expect(aegis.verify(jwe.token)).resolves.toEqual(
      expect.objectContaining({
        format: "jwt",
        wrapper: "jwe",
        header: expect.objectContaining({
          tokenType: "test_token",
        }),
        claims: expect.objectContaining({
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        }),
      }),
    );
  });

  test("should sign and verify jws", async () => {
    const jws = await aegis.jws.sign("data", {
      header: { oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc" },
    });

    await expect(aegis.verify(jws.token)).resolves.toEqual(
      expect.objectContaining({ format: "jws", raw: "data" }),
    );
  });

  test("should sign and verify jwt", async () => {
    const jwt = await aegis.mint("default", {
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    await expect(aegis.verify(jwt.token)).resolves.toEqual(
      expect.objectContaining({
        format: "jwt",
        header: expect.objectContaining({
          tokenType: "test_token",
        }),
        claims: expect.objectContaining({
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        }),
      }),
    );
  });

  test("sign('default', …) re-imposes the historical floor (iss/iat/jti/nbf/exp)", async () => {
    const { token } = await aegis.mint("default", {
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    const { payload } = JwtKit.decode(token);

    expect(payload).toEqual({
      exp: 1704099600,
      iat: 1704096000,
      iss: "https://test.lindorm.io/",
      jti: expect.any(String),
      nbf: 1704096000,
      sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
    });
  });

  test("sign('default', …) throws when a required claim is missing", async () => {
    await expect(
      aegis.mint("default", { tokenType: "test_token" } as never),
    ).rejects.toThrow();
  });

  // ⚠ `aegis.sign` is CLAIMS-ONLY — it takes a domain claim set — so an opaque
  // signature over a wire literal is the `jws` namespace.
  test("jws.sign signs a raw wire literal as a JWS", async () => {
    const res = await aegis.jws.sign("raw-data");

    expect(res).toEqual({
      format: "jws",
      objectId: undefined,
      token: expect.any(String),
    });

    await expect(aegis.verify(res.token)).resolves.toEqual(
      expect.objectContaining({ format: "jws", raw: "raw-data" }),
    );
  });

  // Dict in, Dict out — the payload is handed to the kit as an OBJECT, so the
  // codec declares `application/json` and the read reconstructs the object. The
  // full contract, including that the COSE twin agrees, is the sibling
  // `what an opaque signature hands back` suite.
  test("jws.sign returns a plain object as an object", async () => {
    const res = await aegis.jws.sign({ hello: "world" });

    await expect(aegis.verify(res.token)).resolves.toEqual(
      expect.objectContaining({ format: "jws", raw: { hello: "world" } }),
    );
  });

  /**
   * ⭐ THE DOMAIN VERB IS CLAIMS-ONLY, and its default is `jwt`: this call shape
   * signs a JWT with every registered claim translated to its wire spelling. A
   * caller wanting an opaque signature reaches `aegis.jws.sign`.
   */
  test("sign({ payload }) signs a JWT with translated domain claims", async () => {
    const res = await aegis.sign({ payload: { subject: "user-1" } });

    expect(res.format).toBe("jwt");

    const [, payload] = res.token.split(".");

    expect(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))).toEqual({
      sub: "user-1",
    });
  });

  /**
   * The JOSE FORMAT GUARDS — `Aegis.isJwt` / `isJws` / `isJwe` / `isJose`, the
   * statics a caller asks "which wire is this, and can aegis process it" before
   * routing. They answer from the token's BYTES, never from a vault or a clock,
   * so they are exercised on hand-built segments: an aegis-minted token could
   * never carry the shapes below, and a third party's routinely does.
   *
   * ⚠ Not conformance rows: a row states a capability of a token as it travels a
   * wire, and these are static predicates over a string that need not be a token
   * at all. The scenario table has no artifact for "the empty string".
   */
  describe("the JOSE format guards", () => {
    // The `typ` header is a HINT (RFC 7519 §5.1) — a media type for the JWT
    // APPLICATION to read, pinned by the scenario row
    // `an-asserted-token-type-is-compared-as-a-whole-media-type`. Routing on it
    // as the discriminant would reject every third-party token that spells it
    // differently, or omits it.
    describe("a typ header is a hint, never the discriminant", () => {
      test("a typ-less claims token is a JWT, a JWS, and JOSE", () => {
        const token = jws({ alg: "ES256", kid: "key_1" });

        expect(Aegis.isJwt(token)).toBe(true);
        expect(Aegis.isJws(token)).toBe(true);
        expect(Aegis.isJose(token)).toBe(true);
      });

      test("an RFC 9068 access token is a JWT and a JWS", () => {
        const token = jws({ alg: "ES256", typ: "application/at+jwt" });

        expect(Aegis.isJwt(token)).toBe(true);
        expect(Aegis.isJws(token)).toBe(true);
      });

      // RFC 7519 §3.
      test("a JWT is also a JWS", () => {
        expect(Aegis.isJws(jws({ alg: "ES256", typ: "JWT" }))).toBe(true);
      });

      test("a typ-less JWE is a JWE and JOSE", () => {
        const token = jwe({ alg: "ECDH-ES", enc: "A256GCM" });

        expect(Aegis.isJwe(token)).toBe(true);
        expect(Aegis.isJose(token)).toBe(true);
      });

      // `enc` is a REQUIRED JWE Protected Header parameter (RFC 7516 §4.1.2), so
      // a five-segment token without one is not a JWE however it is typed.
      test("a five-segment token without enc is not a JWE", () => {
        expect(Aegis.isJwe(jwe({ alg: "dir", typ: "JWE" }))).toBe(false);
      });
    });

    // An opaque signed handle must never read as claims-bearing: a consumer that
    // believed it was would parse whatever the payload happened to be as an
    // authenticated claim set.
    describe("an opaque signed token never reads as claims-bearing", () => {
      test("a JWS / JOSE / +jws typ is believed even over a JSON payload", () => {
        const body = seg({ handle: "abc" });

        expect(Aegis.isJwt(jws({ alg: "ES256", typ: "JWS" }, body))).toBe(false);
        expect(Aegis.isJwt(jws({ alg: "ES256", typ: "JOSE" }, body))).toBe(false);
        expect(Aegis.isJwt(jws({ alg: "ES256", typ: "application/at+jws" }, body))).toBe(
          false,
        );
      });

      test("a typ-less opaque payload is a JWS but not a JWT", () => {
        const token = jws({ alg: "ES256" }, raw("opaque-handle"));

        expect(Aegis.isJws(token)).toBe(true);
        expect(Aegis.isJwt(token)).toBe(false);
      });

      test("a declared JWT typ over a non-claims payload is not a JWT", () => {
        expect(Aegis.isJwt(jws({ alg: "ES256", typ: "JWT" }, raw("opaque-handle")))).toBe(
          false,
        );
      });
    });

    // A library must not route a token whose algorithm it will not perform, and
    // `none` is the Unsecured JWS, which carries no integrity protection at all.
    // RFC 8725 §3.2, RFC 7515 Appendix A.5.
    describe("the algorithm allowlist", () => {
      test("an unsecured alg-none token is no JOSE format aegis will route", () => {
        const token = jws({ alg: "none" });

        expect(Aegis.isJwt(token)).toBe(false);
        expect(Aegis.isJws(token)).toBe(false);
        expect(Aegis.isJose(token)).toBe(false);
      });

      test("an unsupported alg is rejected on every guard", () => {
        expect(Aegis.isJwt(jws({ alg: "RS1" }))).toBe(false);
        expect(Aegis.isJws(jws({ alg: "RS1" }))).toBe(false);
        expect(Aegis.isJwe(jwe({ alg: "RSA1_5", enc: "A256GCM" }))).toBe(false);
      });
    });

    describe("anything that is not a compact JOSE token", () => {
      test("false for a bare handle and for the empty string", () => {
        for (const guard of [Aegis.isJwt, Aegis.isJws, Aegis.isJwe, Aegis.isJose]) {
          expect(guard("opaque-access-token")).toBe(false);
          expect(guard("")).toBe(false);
        }
      });

      // `alg` is REQUIRED (RFC 7515 §4.1.1), so a header without one describes no
      // signature to check.
      test("false when the header carries no alg", () => {
        expect(Aegis.isJws(jws({ typ: "JWT" }))).toBe(false);
        expect(Aegis.isJwt(jws({ typ: "JWT" }))).toBe(false);
      });
    });
  });

  /**
   * THE KEY POLICY `Aegis` ASSEMBLES — the deployment default merged with the
   * per-call condition, and the profile floor laid over both.
   *
   * The merge lives on this class (its `resolveSignKey` / `resolveVerifyKey`
   * closures), which is why it is asserted here: `resolve-key.ts` receives ONE
   * already-merged selector and cannot see which half of it came from where, and
   * a conformance row states what a token does on a wire rather than which vault
   * resident produced it. What is under test is that a deployment's standing
   * policy and a caller's per-call one compose the way an operator would read
   * them: the caller narrows, the deployment supplies everything the caller did
   * not mention, and the floor overrides both.
   */
  describe("the key policy — deployment merged with per-call", () => {
    test("a per-call algorithm overrides the deployment default — the caller wins", async () => {
      amphora.add(TEST_OKP_KEY_SIG); // EdDSA
      amphora.add(TEST_OCT_KEY_SIG); // HS256

      const deployment = new Aegis({
        amphora,
        logger,
        sign: { condition: { algorithm: "EdDSA" } },
      });

      const standing = await deployment.jwt.sign({ sub: "s" });
      expect(JwtKit.decode(standing.token).header.alg).toBe("EdDSA");

      const perCall = await deployment.jwt.sign(
        { sub: "s" },
        { key: { condition: { algorithm: "HS256" } } },
      );
      expect(JwtKit.decode(perCall.token).header.alg).toBe("HS256");
    });

    test("a per-call condition pins a key by id", async () => {
      amphora.add(TEST_OKP_KEY_SIG);

      const { token } = await aegis.jwt.sign(
        { sub: "s" },
        { key: { condition: { id: TEST_OKP_KEY_SIG.id } } },
      );

      expect(JwtKit.decode(token).header.kid).toBe(TEST_OKP_KEY_SIG.id);
    });

    // FAPI is deployment POLICY rather than a key property: aegis publishes the
    // list and the deployment applies it as a selector. HS256 and ES512 are both
    // in the vault and neither is on it.
    test("an allowlist selects with $in", async () => {
      amphora.add(TEST_OCT_KEY_SIG); // HS256
      amphora.add(TEST_OKP_KEY_SIG); // EdDSA — the only FAPI-listed key held

      const { token } = await aegis.jwt.sign(
        { sub: "s" },
        { key: { condition: { algorithm: { $in: FAPI_SIG_ALGS } } } },
      );

      expect(JwtKit.decode(token).header.alg).toBe("EdDSA");
    });

    // A selector that matches nothing must fail LOUDLY. Falling back to the
    // deployment default would sign with a key the caller explicitly ruled out,
    // and the caller would never learn its constraint had been discarded.
    test("a selector that matches nothing throws rather than falling back", async () => {
      const error = await aegis.jwt
        .sign({ sub: "s" }, { key: { condition: { purpose: "none" } } })
        .catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("sign_key_not_found");
    });

    // Models an OIDC client that registered no signing algorithm: the per-call
    // value arrives as `undefined`. An absent value is the caller DECLINING to
    // narrow, so it must fall back to the deployment's allowlist — reading it as
    // "no constraint" turns every unconfigured client into a match-all and hands
    // it whichever key sorted first, which is the ES512 one here.
    test("a per-call undefined condition value does not erase the deployment allowlist", async () => {
      amphora.add(TEST_OKP_KEY_SIG);

      const deployment = new Aegis({
        amphora,
        logger,
        sign: { condition: { algorithm: { $in: ["EdDSA"] } } },
      });

      const { token } = await deployment.jwt.sign(
        { sub: "s" },
        { key: { condition: { algorithm: undefined } } },
      );

      expect(JwtKit.decode(token).header.kid).toBe(TEST_OKP_KEY_SIG.id);
    });

    // The merge is SHALLOW: a field the caller does not mention keeps the
    // deployment's value. A replacement instead of a merge would silently widen
    // every call that narrowed on one field.
    test("a field the caller does not mention keeps the deployment's value", async () => {
      amphora.add(KryptosKit.clone(TEST_OKP_KEY_SIG, { purpose: "token" }));

      const deployment = new Aegis({
        amphora,
        logger,
        sign: { condition: { purpose: "token" } },
      });

      const { token } = await deployment.jwt.sign(
        { sub: "s" },
        { key: { condition: { algorithm: "EdDSA" } } },
      );

      expect(JwtKit.decode(token).header.alg).toBe("EdDSA");
      expect(JwtKit.decode(token).header.kid).toBe(TEST_OKP_KEY_SIG.id);
    });

    /**
     * A token must not choose the class of key that verifies it
     * (RFC 8725 §3.1). Selection is
     * driven by the token's own `kid`, so a deployment-wide verify policy is a
     * CHECK on the key that kid names, applied before the signature is touched.
     */
    test("a deployment verify policy refuses a token whose kid names a forbidden key", async () => {
      amphora.add(TEST_OCT_KEY_SIG);

      const minter = new Aegis({ amphora, logger });
      const { token } = await minter.mint(
        "default",
        { subject: "s", expires: "1h", tokenType: "N_A" },
        { sign: { key: { condition: { algorithm: "HS256" } } } },
      );

      const verifier = new Aegis({
        amphora,
        logger,
        verify: { condition: { algClass: "asymmetric" } },
      });

      const error = await verifier.jwt.verify(token).catch((err: Error) => err);

      expect(error).toBeInstanceOf(AegisError);
      expect((error as AegisError).code).toBe("verify_key_policy_violation");
      expect((error as AegisError).data).toMatchObject({
        algClass: "symmetric",
        kid: TEST_OCT_KEY_SIG.id,
      });
    });

    /**
     * A client may register `id_token_signed_response_alg: HS256`
     * (OIDC Core §10.1), where the client secret IS the MAC key — per-client, held
     * out-of-band and emphatically not a vault resident. Both outcomes below are
     * correct and the difference is the PROFILE's floor and nothing else, which
     * is what makes key injection a supported deployment shape rather than an
     * escape hatch from policy.
     */
    describe("an injected client secret", () => {
      const CLIENT_SECRET = KryptosKit.from.utf({
        type: "oct",
        use: "sig",
        algorithm: "HS256",
        privateKey: "a-client-secret-long-enough-for-hs256-hmac",
      });

      test("signs an id_token, whose profile states no algorithm-class floor", async () => {
        const { token } = await aegis.mint(
          "id_token",
          { subject: "user-1", audience: ["client-1"] },
          {
            context: { accessTokenIssued: false },
            sign: { key: { kryptos: CLIENT_SECRET } },
          },
        );

        expect(JwtKit.decode(token).header.alg).toBe("HS256");
        expect(JwtKit.decode(token).header.kid).toBe(CLIENT_SECRET.id);
      });

      test("is refused for an access_token, whose profile demands an asymmetric signature", async () => {
        const error = await aegis
          .mint(
            "access_token",
            {
              subject: "user-1",
              audience: ["https://rs.lindorm.io/"],
              clientId: "client-1",
            },
            { sign: { key: { kryptos: CLIENT_SECRET } } },
          )
          .catch((err: Error) => err);

        expect(error).toBeInstanceOf(AegisError);
        expect((error as AegisError).code).toBe("sign_key_policy_violation");
        expect((error as AegisError).data).toMatchObject({
          algClass: "symmetric",
          profile: "access_token",
        });
      });
    });
  });

  /**
   * Issuer scoping makes two separately-configured strings load-bearing: amphora
   * stamps every key it holds with ITS issuer, and a token aegis mints carries
   * AEGIS's. A difference is a hard failure to resolve our own signing key, and
   * the error it produces does not point at the cause — so it is said once, at
   * construction.
   */
  describe("issuer coherence", () => {
    const withChildLogger = (): { parent: ILogger; child: ILogger } => {
      const parent = createMockLogger();
      const child = createMockLogger();
      vi.mocked(parent.child).mockReturnValue(child);
      return { parent, child };
    };

    test("warns when the aegis issuer differs from the amphora issuer", () => {
      const { parent, child } = withChildLogger();

      new Aegis({ amphora, issuer: "https://other.lindorm.io/", logger: parent });

      expect(child.warn).toHaveBeenCalledWith(
        "Aegis issuer differs from the amphora issuer; verification of self-issued tokens will fail",
        { aegis: "https://other.lindorm.io/", amphora: "https://test.lindorm.io/" },
      );
    });

    test("stays silent when they agree", () => {
      const { parent, child } = withChildLogger();

      new Aegis({ amphora, issuer: "https://test.lindorm.io/", logger: parent });

      expect(child.warn).not.toHaveBeenCalled();
    });

    // A verify-only deployment declares no issuer of its own on amphora; there is
    // nothing to disagree with, so an aegis issuer is not a misconfiguration.
    test("stays silent when amphora declares no internal issuer", () => {
      const { parent, child } = withChildLogger();

      new Aegis({
        amphora: new Amphora({ logger: parent }),
        issuer: "https://only-aegis.lindorm.io/",
        logger: parent,
      });

      expect(child.warn).not.toHaveBeenCalled();
    });
  });

  test("registerProfile registers a custom profile usable by sign", async () => {
    aegis.registerProfile({
      name: "custom_aegis_profile",
      typ: { presence: "required", value: "custom+jwt" },
      policy: [{ rule: "required", on: ["mint", "verify"], claims: ["subject"] }],
      autoInject: ["issuedAt", "tokenId", "issuer"],
      issuer: "platform",
      lifetime: "1h",
      encryptable: false,
    });

    const { token } = await aegis.mint("custom_aegis_profile", {
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    const { payload } = JwtKit.decode(token);

    expect(payload.sub).toBe("3f2ae79d-f1d1-556b-a8bc-305e6b2334ad");
    expect(payload.exp).toBe(1704099600);
    expect(payload.nbf).toBeUndefined();
  });
});
