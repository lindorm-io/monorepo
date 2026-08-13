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
