import { B64 } from "@lindorm/b64";
import { ShaKit } from "@lindorm/sha";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG, TEST_RSA_KEY_SIG } from "../__fixtures__/keys.js";
import { AegisDomainError } from "../errors/index.js";
import { createJoseSignature } from "../internal/utils/jose-signature.js";
import { Aegis } from "./Aegis.js";
import { afterEach, describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");

/**
 * `Aegis.verifyDpopProof` is the STANDALONE surface a resource server needs when
 * the access token is not locally verifiable — RFC 9449 §6.2 hands it `cnf.jkt`
 * through the introspection response instead of through a verified JWT.
 */
describe("Aegis.verifyDpopProof", () => {
  const accessToken = "test-access-token";
  const expectedThumbprint = TEST_RSA_KEY_SIG.thumbprint;
  const publicJwk = TEST_RSA_KEY_SIG.export("jwk");

  const signProof = (payloadOverrides: Record<string, unknown> = {}): string => {
    const header = B64.encode(
      JSON.stringify({ alg: "RS512", typ: "dpop+jwt", jwk: publicJwk }),
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

    return `${header}.${payload}.${createJoseSignature({
      header,
      payload,
      kryptos: TEST_RSA_KEY_SIG,
    })}`;
  };

  afterEach(() => {
    MockDate.reset();
  });

  test("should parse a valid proof without any Aegis instance", () => {
    MockDate.set(MockedDate);

    expect(
      Aegis.verifyDpopProof({ proof: signProof(), accessToken, expectedThumbprint }),
    ).toMatchSnapshot();
  });

  test("should reject a proof whose key is not the bound key", () => {
    MockDate.set(MockedDate);

    expect(() =>
      Aegis.verifyDpopProof({
        proof: signProof(),
        accessToken,
        expectedThumbprint: TEST_EC_KEY_SIG.thumbprint,
      }),
    ).toThrow(AegisDomainError);
  });

  test("should reject a proof whose ath hashes a different access token", () => {
    MockDate.set(MockedDate);

    expect(() =>
      Aegis.verifyDpopProof({
        proof: signProof(),
        accessToken: "some-other-access-token",
        expectedThumbprint,
      }),
    ).toThrow(AegisDomainError);
  });

  test("should apply the default skew when none is given", () => {
    // Default is 60s — two minutes on is outside it.
    MockDate.set(new Date(MockedDate.getTime() + 120_000));

    expect(() =>
      Aegis.verifyDpopProof({ proof: signProof(), accessToken, expectedThumbprint }),
    ).toThrow(AegisDomainError);
  });

  test("should honour an explicit dpopMaxSkew", () => {
    MockDate.set(new Date(MockedDate.getTime() + 120_000));

    expect(() =>
      Aegis.verifyDpopProof({
        proof: signProof(),
        accessToken,
        expectedThumbprint,
        dpopMaxSkew: 600,
      }),
    ).not.toThrow();
  });
});
