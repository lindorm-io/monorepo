import { B64 } from "@lindorm/b64";
import { ShaKit } from "@lindorm/sha";
import MockDate from "mockdate";
import { TEST_AKP_KEY_SIG, TEST_RSA_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { AegisDomainError } from "../../errors/index.js";
import { createJoseSignature } from "./jose-signature.js";
import { verifyDpopProof } from "./verify-dpop-proof.js";
import { afterEach, describe, expect, test } from "vitest";

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
      }),
    ).toThrow(/iat is outside/);
  });

  /**
   * A DPoP proof is attacker-supplied: the presenter signs it, and the verifier
   * has only its own type checks between the wire and the values it hands back.
   * `jti`/`htm`/`htu` are required (RFC 9449 §4.2) because something downstream
   * acts on each — `jti` is what makes the proof single-use, `htm`/`htu` are what
   * bind it to one request. A claim carried as an empty
   * string satisfies "present" while naming nothing: a replay cache keyed on an
   * empty `jti` collapses every proof onto one entry, and an empty `htu` binds
   * the proof to no request at all.
   */
  test.each(["jti", "htm", "htu"])(
    "should throw when the %s claim is an empty string",
    (claim) => {
      const proof = signProof({ [claim]: "" });

      expect(() =>
        verifyDpopProof({ proof, accessToken, expectedThumbprint, dpopMaxSkew: 60 }),
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
      verifyDpopProof({ proof, accessToken, expectedThumbprint, dpopMaxSkew: 60 }),
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
      verifyDpopProof({ proof, accessToken, expectedThumbprint, dpopMaxSkew: 60 }).nonce,
    ).toBeUndefined();
  });

  test("should report a string nonce the proof does carry", () => {
    const proof = signProof({ nonce: "server-nonce-1" });

    expect(
      verifyDpopProof({ proof, accessToken, expectedThumbprint, dpopMaxSkew: 60 }).nonce,
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
   * Everything it does BEYOND this file's subject is supply the skew window, so
   * that is all it is exercised on here: the rest of the proof check is the body
   * above, reached through the same call. The window matters on its own because
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
});
