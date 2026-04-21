import { B64 } from "@lindorm/b64";
import { ShaKit } from "@lindorm/sha";
import MockDate from "mockdate";
import { TEST_RSA_KEY_SIG } from "../../__fixtures__/keys.js";
import { JwtError } from "../../errors/index.js";
import { createJoseSignature } from "./jose-signature.js";
import { verifyDpopProof } from "./verify-dpop-proof.js";
import { describe, expect, test } from "vitest";

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
    ).toThrow(JwtError);
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
});
