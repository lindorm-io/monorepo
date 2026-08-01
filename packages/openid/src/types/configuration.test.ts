import { describe, expect, test } from "vitest";
import { ResponseType } from "../enums/ResponseType.js";
import { SubjectType } from "../enums/SubjectType.js";
import type { OpenIdConfiguration } from "./configuration.js";

/**
 * The minimum a spec-compliant provider MUST publish — OIDC Discovery §3.
 * That this compiles is the assertion: nothing beyond these seven members is
 * required, and none of them may be dropped.
 */
const MINIMAL: OpenIdConfiguration = {
  issuer: "https://test.lindorm.io",
  authorizationEndpoint: "https://test.lindorm.io/oauth/authorize",
  tokenEndpoint: "https://test.lindorm.io/oauth/token",
  jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
  responseTypesSupported: [ResponseType.Code],
  subjectTypesSupported: [SubjectType.Public],
  idTokenSigningAlgValuesSupported: ["RS256"],
};

describe("OpenIdConfiguration", () => {
  test("should match snapshot for the spec-minimal document", () => {
    expect(MINIMAL).toMatchSnapshot();
  });

  // TypeScript reports only the FIRST excess property of an object literal, so
  // each wrong wire name needs a literal of its own to be genuinely asserted.
  test("should reject the spec bugs the deleted type carried", () => {
    const introspect: OpenIdConfiguration = {
      ...MINIMAL,
      // @ts-expect-error RFC 8414 §2 is `introspection_endpoint`, never `introspect_endpoint`
      introspectEndpoint: "https://test.lindorm.io/oauth/introspect",
    };

    const logout: OpenIdConfiguration = {
      ...MINIMAL,
      // @ts-expect-error OIDC RP-Initiated Logout is `end_session_endpoint`, not `logout_endpoint`
      logoutEndpoint: "https://test.lindorm.io/oauth/logout",
    };

    const revoke: OpenIdConfiguration = {
      ...MINIMAL,
      // @ts-expect-error RFC 7009 is `revocation_endpoint`; there is no `revoke_endpoint`
      revokeEndpoint: "https://test.lindorm.io/oauth/revoke",
    };

    expect([introspect, logout, revoke]).toBeDefined();
  });

  test("should reject the deleted subject type values", () => {
    const configuration: OpenIdConfiguration = {
      ...MINIMAL,

      // @ts-expect-error OIDC Core §8 defines `pairwise` | `public`
      subjectTypesSupported: ["client", "identity"],
    };

    expect(configuration).toBeDefined();
  });

  test("should serve the RFC-correct endpoint names", () => {
    const configuration: OpenIdConfiguration = {
      ...MINIMAL,
      introspectionEndpoint: "https://test.lindorm.io/oauth/introspection",
      endSessionEndpoint: "https://test.lindorm.io/oauth/end-session",
      revocationEndpoint: "https://test.lindorm.io/oauth/revocation",
    };

    expect(configuration).toMatchSnapshot();
  });

  test("should serve the lindorm extension endpoints", () => {
    const configuration: OpenIdConfiguration = {
      ...MINIMAL,
      gdprRightToErasureEndpoint: "https://test.lindorm.io/gdpr/erasure",
      gdprRightOfAccessEndpoint: "https://test.lindorm.io/gdpr/disclosure",
      gdprRightToDataPortabilityEndpoint: "https://test.lindorm.io/gdpr/portability",
      deviceAuthorizationEndpoint: "https://test.lindorm.io/oauth/device/code",
    };

    expect(configuration).toMatchSnapshot();
  });

  test("should reject the extension endpoints the design dropped", () => {
    const forgotten: OpenIdConfiguration = {
      ...MINIMAL,
      // @ts-expect-error renamed to `gdpr_right_to_erasure_endpoint`
      rightToBeForgottenEndpoint: "https://test.lindorm.io/oauth/right-to-be-forgotten",
    };

    const exchange: OpenIdConfiguration = {
      ...MINIMAL,
      // @ts-expect-error token exchange is a GRANT at the ordinary token endpoint
      tokenExchangeEndpoint: "https://test.lindorm.io/oauth/token-exchange",
    };

    const mfa: OpenIdConfiguration = {
      ...MINIMAL,
      // @ts-expect-error `mfa_challenge_endpoint` is an auth0 vendor field, not ours
      mfaChallengeEndpoint: "https://test.lindorm.io/mfa/challenge",
    };

    expect([forgotten, exchange, mfa]).toBeDefined();
  });

  test("should serve the draft authorization challenge endpoint", () => {
    const configuration: OpenIdConfiguration = {
      ...MINIMAL,
      authorizationChallengeEndpoint: "https://test.lindorm.io/oauth/authorize-challenge",
    };

    expect(configuration).toMatchSnapshot();
  });

  test("should satisfy the conduit client-credentials read", () => {
    // `token_endpoint` is REQUIRED — always present, no absence handling needed.
    expect(MINIMAL.tokenEndpoint).toBe("https://test.lindorm.io/oauth/token");
  });

  test("should satisfy the amphora issuer read", () => {
    // `issuer` and `jwks_uri` are REQUIRED — always present.
    expect([MINIMAL.issuer, MINIMAL.jwksUri]).toMatchSnapshot();
  });

  test("should satisfy the pylon relying-party read", () => {
    // The two REQUIRED endpoints are typed present; the rest are OPTIONAL by
    // spec, so pylon keeps throwing its named errors at the point of use.
    const required: [string, string] = [
      MINIMAL.authorizationEndpoint,
      MINIMAL.tokenEndpoint,
    ];
    const optional: Array<string | Array<string> | undefined> = [
      MINIMAL.userinfoEndpoint,
      MINIMAL.introspectionEndpoint,
      MINIMAL.endSessionEndpoint,
      MINIMAL.tokenEndpointAuthMethodsSupported,
    ];

    expect({ required, optional }).toMatchSnapshot();
  });
});
