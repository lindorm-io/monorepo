import { Amphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ShaKit } from "@lindorm/sha";
import MockDate from "mockdate";
import {
  TEST_AKP_KEY_SIG,
  TEST_EC_KEY_SIG,
  TEST_RSA_KEY_SIG,
} from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { AegisDomainError } from "../../errors/index.js";
import { createJoseSignature } from "./jose-signature.js";
import { verifyDpopProof } from "./verify-dpop-proof.js";
import { afterEach, beforeAll, describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("verifyDpopProof", () => {
  const accessToken = "test-access-token";
  const expectedThumbprint = TEST_RSA_KEY_SIG.thumbprint;
  const publicJwk = TEST_RSA_KEY_SIG.export("jwk");

  const signProof = (
    payloadOverrides: Record<string, unknown> = {},
    headerOverrides: Record<string, unknown> = {},
  ): string => {
    const header = B64.encode(
      JSON.stringify({
        alg: "RS512",
        typ: "dpop+jwt",
        jwk: publicJwk,
        ...headerOverrides,
      }),
      "b64u",
    );
    const payload = B64.encode(
      JSON.stringify({
        jti: "proof-jti",
        htm: "POST",
        htu: "https://api.example.com/resource",
        iat: Math.floor(MockedDate.getTime() / 1000),
        ath: ShaKit.S256(accessToken),
        ...payloadOverrides,
      }),
      "b64u",
    );
    const signature = createJoseSignature({
      header,
      payload,
      kryptos: TEST_RSA_KEY_SIG,
    });
    return `${header}.${payload}.${signature}`;
  };

  test("should return a parsed proof for a valid DPoP proof", () => {
    const proof = signProof();

    expect(
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toMatchSnapshot();
  });

  test("should throw when proof is not a compact JWS", () => {
    expect(() =>
      verifyDpopProof({
        proof: "not.a.valid.jws",
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toThrow(AegisDomainError);
  });

  test("should throw when header typ is not dpop+jwt", () => {
    const proof = signProof({}, { typ: "jwt" });

    expect(() =>
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toThrow(/typ must be dpop\+jwt/);
  });

  test("should throw when header jwk is missing", () => {
    const proof = signProof({}, { jwk: undefined });

    expect(() =>
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toThrow(/header jwk is required/);
  });

  test("should throw when thumbprint does not match expected", () => {
    const proof = signProof();

    expect(() =>
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint: "wrong-thumbprint",
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toThrow(/thumbprint does not match cnf\.jkt/);
  });

  test("should throw when ath does not match the access token hash", () => {
    const proof = signProof({ ath: ShaKit.S256("other-access-token") });

    expect(() =>
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toThrow(/ath does not match/);
  });

  test("should throw when iat is outside the allowed skew window", () => {
    const proof = signProof({
      iat: Math.floor(MockedDate.getTime() / 1000) - 120,
    });

    expect(() =>
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toThrow(/iat is outside/);
  });

  /**
   * A DPoP proof is attacker-supplied: the presenter signs it, and the verifier
   * has only its own type checks between the wire and the values it hands back.
   * `jti`/`htm`/`htu` are required (RFC 9449 §4.2) because something downstream
   * acts on each — `jti` is the value a replay cache is keyed on, `htm`/`htu` are
   * what bind the proof to one request. A claim carried as an empty
   * string satisfies "present" while naming nothing: a replay cache keyed on an
   * empty `jti` collapses every proof onto one entry, and an empty `htu` binds
   * the proof to no request at all.
   */
  test.each(["jti", "htm", "htu"])(
    "should throw when the %s claim is an empty string",
    (claim) => {
      const proof = signProof({ [claim]: "" });

      expect(() =>
        verifyDpopProof({
          proof,
          accessToken,
          expectedThumbprint,
          dpopMaxSkew: 60,
          declared: undefined,
        }),
      ).toThrow(
        expect.objectContaining({
          code: "dpop_claim_required",
          data: { claim },
        }),
      );
    },
  );

  /**
   * `iat` is the freshness anchor: the skew window is computed from it, so a
   * value that is not a number makes the arithmetic meaningless rather than
   * merely wrong. `new Date(x * 1000)` on a string or an object yields an
   * Invalid Date, whose comparisons are all false — so every skew check silently
   * passes and the proof is accepted as fresh forever.
   */
  test.each([
    ["a string", "1704096000"],
    ["an object", {}],
    ["null", null],
    ["a boolean", true],
  ])("should throw when iat is %s rather than a number", (_label, iat) => {
    const proof = signProof({ iat });

    expect(() =>
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toThrow(expect.objectContaining({ code: "dpop_iat_required" }));
  });

  /**
   * `nonce` is OPTIONAL (RFC 9449 §8), so a proof without one is conformant and
   * the parsed result must report its absence rather than a value. A non-string
   * on the wire is not a nonce, and passing it through would hand a caller a
   * number or an object under a field its type declares to be a string — the
   * caller then compares it against the nonce it issued and the comparison is
   * meaningless.
   */
  test.each([
    ["a number", 42],
    ["an object", { nonce: "n" }],
    ["null", null],
    ["an array", ["n"]],
  ])("should report no nonce when the proof carries %s", (_label, nonce) => {
    const proof = signProof({ nonce });

    expect(
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }).nonce,
    ).toBeUndefined();
  });

  test("should report a string nonce the proof does carry", () => {
    const proof = signProof({ nonce: "server-nonce-1" });

    expect(
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }).nonce,
    ).toBe("server-nonce-1");
  });

  test("should throw when htm claim is missing", () => {
    const proof = signProof({ htm: undefined });

    expect(() =>
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toThrow(/"htm" claim is required/);
  });

  test("should verify a DPoP proof signed with an ML-DSA (AKP) key", () => {
    const akpJwk = TEST_AKP_KEY_SIG.export("jwk");

    const header = B64.encode(
      JSON.stringify({
        alg: TEST_AKP_KEY_SIG.algorithm,
        typ: "dpop+jwt",
        jwk: akpJwk,
      }),
      "b64u",
    );
    const payload = B64.encode(
      JSON.stringify({
        jti: "akp-proof-jti",
        htm: "POST",
        htu: "https://api.example.com/resource",
        iat: Math.floor(MockedDate.getTime() / 1000),
        ath: ShaKit.S256(accessToken),
      }),
      "b64u",
    );
    const signature = createJoseSignature({
      header,
      payload,
      kryptos: TEST_AKP_KEY_SIG,
    });
    const proof = `${header}.${payload}.${signature}`;

    expect(
      verifyDpopProof({
        proof,
        accessToken,
        expectedThumbprint: TEST_AKP_KEY_SIG.thumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toMatchSnapshot();
  });

  test("should throw when signature verification fails", () => {
    const proof = signProof();
    // Tamper with the payload
    const [header, , signature] = proof.split(".");
    const tamperedPayload = B64.encode(
      JSON.stringify({
        jti: "different",
        htm: "POST",
        htu: "https://api.example.com/resource",
        iat: Math.floor(MockedDate.getTime() / 1000),
        ath: ShaKit.S256(accessToken),
      }),
      "b64u",
    );
    const tampered = `${header}.${tamperedPayload}.${signature}`;

    expect(() =>
      verifyDpopProof({
        proof: tampered,
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 60,
        declared: undefined,
      }),
    ).toThrow(/signature verification failed/);
  });

  /**
   * `Aegis.verifyDpopProof` is the STANDALONE surface a resource server needs
   * when the access token is not locally verifiable — RFC 9449 §6.2 conveys the
   * binding through the introspection response instead of a verified JWT, and
   * has the resource server validate it locally. It is a static because the
   * proof carries its own key, so there is no vault to resolve against.
   *
   * Everything it does BEYOND this file's subject is supply the skew window and
   * translate the caller's `critical` declaration to wire names — the window is
   * exercised here, the declaration in the crit-gate describe below; the rest of
   * the proof check is the body above, reached through the same call. The window
   * matters on its own because
   * the freshness bound is the only thing that stops a captured proof being
   * replayed, and a wrapper that dropped the caller's value would silently
   * substitute its own.
   */
  describe("Aegis.verifyDpopProof — the standalone surface", () => {
    afterEach(() => MockDate.set(MockedDate));

    test("should apply the default skew when the caller states none", () => {
      const proof = signProof();

      // Two minutes on, against a 60-second default.
      MockDate.set(new Date(MockedDate.getTime() + 120_000));

      expect(() =>
        Aegis.verifyDpopProof({ proof, accessToken, expectedThumbprint }),
      ).toThrow(AegisDomainError);
    });

    test("should honour a skew the caller states", () => {
      const proof = signProof();

      MockDate.set(new Date(MockedDate.getTime() + 120_000));

      expect(() =>
        Aegis.verifyDpopProof({
          proof,
          accessToken,
          expectedThumbprint,
          dpopMaxSkew: 600,
        }),
      ).not.toThrow();
    });
  });

  /**
   * The proof is a compact JWS, so its header answers to `crit` exactly as a
   * JWT's does: a listed extension the recipient does not understand invalidates
   * it (RFC 7515 §4.1.11), and aegis is never the final recipient, so it refuses
   * until the caller declares the parameter — the gate every JOSE verify door
   * runs, under this door's own code family. The MALFORMED half is pinned here at
   * the public door; the feature files state the declared/undeclared pair.
   */
  describe("Aegis.verifyDpopProof — the crit gate", () => {
    test("should refuse a proof marking a carried extension critical when nothing is declared", () => {
      const proof = signProof({}, { crit: ["x-ext"], "x-ext": "carried" });

      expect(() =>
        Aegis.verifyDpopProof({ proof, accessToken, expectedThumbprint }),
      ).toThrow(AegisDomainError);
      expect(() =>
        Aegis.verifyDpopProof({ proof, accessToken, expectedThumbprint }),
      ).toThrow(
        expect.objectContaining({
          code: "dpop_unsupported_crit_param",
          title: "JWT DPoP Unsupported Crit Param",
          data: { param: "x-ext" },
          details: expect.stringContaining("critical option of verifyDpopProof"),
        }),
      );
    });

    test.each([
      ["is not an array", { crit: "x-ext", "x-ext": "carried" }],
      ["is empty", { crit: [] }],
      ["names a parameter the header does not carry", { crit: ["x-ext"] }],
      ["names a specification-defined parameter", { crit: ["typ"] }],
    ])("should refuse a proof whose crit %s as malformed", (_label, headerOverrides) => {
      const proof = signProof({}, headerOverrides);

      expect(() =>
        Aegis.verifyDpopProof({ proof, accessToken, expectedThumbprint }),
      ).toThrow(
        expect.objectContaining({
          code: "dpop_invalid_crit",
          title: "JWT DPoP Invalid Crit",
        }),
      );
    });

    test("should verify a proof marking a carried extension critical when the caller declares it", () => {
      const proof = signProof({}, { crit: ["x-ext"], "x-ext": "carried" });

      expect(
        Aegis.verifyDpopProof({
          proof,
          accessToken,
          expectedThumbprint,
          critical: ["x-ext"],
        }),
      ).toMatchSnapshot();
    });

    /**
     * The declaration is DOMAIN-named, like every other domain surface, and is
     * translated once at this door: `objectId` reaches the gate as the `oid` the
     * proof carries, and a wire spelling here is refused, never quietly accepted.
     */
    test("should translate a domain-named declaration to the wire name the proof carries", () => {
      const proof = signProof({}, { crit: ["oid"], oid: "1.2.3.4" });

      expect(
        Aegis.verifyDpopProof({
          proof,
          accessToken,
          expectedThumbprint,
          critical: ["objectId"],
        }),
      ).toMatchSnapshot();
    });

    test("should refuse a declaration spelled in the wire vocabulary", () => {
      const proof = signProof({}, { crit: ["oid"], oid: "1.2.3.4" });

      expect(() =>
        Aegis.verifyDpopProof({
          proof,
          accessToken,
          expectedThumbprint,
          critical: ["oid"],
        }),
      ).toThrow(expect.objectContaining({ code: "crit_declaration_not_domain_named" }));
    });

    test("should verify a proof carrying no crit whatever the caller declares", () => {
      const proof = signProof();

      expect(
        Aegis.verifyDpopProof({
          proof,
          accessToken,
          expectedThumbprint,
          critical: ["x-ext"],
        }),
      ).toMatchSnapshot();
    });
  });

  /**
   * The SECOND door onto the same gate: `aegis.verify` handed a `dpopProof` runs
   * this file's subject on the proof, and the call's ONE `critical` declaration
   * governs the token's header and the proof's alike — a caller that has taken an
   * extension on has taken it on for the whole presentation.
   */
  describe("aegis.verify — the declaration governs the proof too", () => {
    const logger = createMockLogger();
    let aegis: Aegis;
    let token: string;

    beforeAll(async () => {
      const amphora = new Amphora({
        internal: { issuer: "https://test.lindorm.io/" },
        logger,
      });
      await amphora.setup();
      amphora.add(TEST_EC_KEY_SIG);
      aegis = new Aegis({ amphora, logger });

      // Bound to the key whose public half every proof below carries in `jwk`.
      const minted = await aegis.mint("default", {
        subject: "user-1",
        expires: "1h",
        confirmation: { thumbprint: expectedThumbprint },
      });
      token = minted.token;
    });

    // A proof for THIS token — `ath` commits to the token it is presented with
    // (RFC 9449 §4.2) — marking a carried extension critical.
    const proofFor = (presented: string): string =>
      signProof({ ath: ShaKit.S256(presented) }, { crit: ["x-ext"], "x-ext": "carried" });

    test("should verify a bound token with a proof marking a declared extension critical", async () => {
      await expect(
        aegis.verify(token, undefined, {
          dpopProof: proofFor(token),
          critical: ["x-ext"],
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          dpop: expect.objectContaining({ tokenId: "proof-jti" }),
        }),
      );
    });

    test("should refuse the same presentation when the call declares nothing", async () => {
      await expect(
        aegis.verify(token, undefined, { dpopProof: proofFor(token) }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "dpop_unsupported_crit_param",
          data: { param: "x-ext" },
        }),
      );
    });
  });
});
