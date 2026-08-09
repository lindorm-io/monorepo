import { describe, expect, test } from "vitest";
import { validateExternalSource } from "./validate-external-source.js";

const JWKS = "https://lindorm.eu.auth0.com/.well-known/jwks.json";
const OIDCONF = "https://lindorm.eu.auth0.com/.well-known/openid-configuration";

/**
 * The registration-time mirror of `resolveExternalConfig`. Two different
 * questions with two different guards: an ISSUER is an identity, so a URN is a
 * legal one; everything amphora FETCHES or DERIVES a location from has to be an
 * http(s) URL.
 */
describe("validateExternalSource", () => {
  describe("accepts", () => {
    test("an http(s) discovery uri on its own", () => {
      expect(() =>
        validateExternalSource({ openIdConfigurationUri: OIDCONF }),
      ).not.toThrow();
    });

    test("an http(s) url issuer with no jwksUri — discoverable", () => {
      expect(() =>
        validateExternalSource({ issuer: "https://lindorm.eu.auth0.com/" }),
      ).not.toThrow();
    });

    // The identity half of the rule: an issuer NAMES a key set, it is not
    // necessarily somewhere to fetch one from. Given the address explicitly, a
    // URN issuer is valid and must stay so (the tyr client-cache shape).
    test("a URN issuer WITH an http(s) jwksUri", () => {
      expect(() =>
        validateExternalSource({ issuer: "urn:lindorm:tyr:client:abc", jwksUri: JWKS }),
      ).not.toThrow();
    });

    test("a non-http URI issuer WITH an http(s) jwksUri", () => {
      expect(() =>
        validateExternalSource({ issuer: "ftp://example.com", jwksUri: JWKS }),
      ).not.toThrow();
    });
  });

  describe("refuses what it cannot fetch", () => {
    /**
     * The discovery uri is the FIRST check and it returns early, so a value it
     * waves through skips every later branch. `isUrlLike` waved through anything
     * `new URL` parses — and amphora then either issued a request nothing could
     * serve, or (once the branch narrowed) ignored a value the operator declared.
     * Neither is an answer; the source is refused.
     */
    test.each(["foo:bar", "mailto:keys@example.com", "ftp://example.com/oidc", "x"])(
      "a non-http openIdConfigurationUri: %s",
      (openIdConfigurationUri) => {
        expect(() => validateExternalSource({ openIdConfigurationUri })).toThrow(
          expect.objectContaining({
            code: "external_openid_configuration_uri_not_http_url",
          }),
        );
      },
    );

    // Declared alongside a source that IS otherwise valid — the early return is
    // gone, so this is the case that would silently ignore the operator's value.
    test("a non-http openIdConfigurationUri even when issuer + jwksUri are valid", () => {
      expect(() =>
        validateExternalSource({
          openIdConfigurationUri: "foo:bar",
          issuer: "https://lindorm.eu.auth0.com/",
          jwksUri: JWKS,
        }),
      ).toThrow(
        expect.objectContaining({
          code: "external_openid_configuration_uri_not_http_url",
        }),
      );
    });

    test.each(["foo:bar", "urn:lindorm:keys", "/.well-known/jwks.json"])(
      "a non-http jwksUri: %s",
      (jwksUri) => {
        expect(() =>
          validateExternalSource({ issuer: "https://lindorm.eu.auth0.com/", jwksUri }),
        ).toThrow(expect.objectContaining({ code: "external_jwks_uri_not_http_url" }));
      },
    );

    // Without this, a declared junk jwksUri rode along: the http(s) issuer made
    // the source discoverable, and resolution handed the junk back as the
    // `jwksUri` whenever the discovery document named none of its own.
    test("a non-http jwksUri is refused at registration, not at the fetch", () => {
      expect(() =>
        validateExternalSource({
          issuer: "https://lindorm.eu.auth0.com/",
          jwksUri: "foo:bar",
        }),
      ).toThrow(
        expect.objectContaining({
          title: "External JWKS URI Not HTTP URL",
          data: { jwksUri: "foo:bar" },
        }),
      );
    });
  });

  describe("refuses an issuer nothing can be derived from", () => {
    test.each(["not-a-uri", "foo:bar", "urn:x"])("a non-URI issuer: %s", (issuer) => {
      expect(() => validateExternalSource({ issuer, jwksUri: JWKS })).toThrow(
        expect.objectContaining({ code: "external_issuer_not_uri" }),
      );
    });

    test("a URN issuer with no jwksUri", () => {
      expect(() =>
        validateExternalSource({ issuer: "urn:lindorm:tyr:client:abc" }),
      ).toThrow(
        expect.objectContaining({
          code: "non_http_issuer_requires_jwks_uri",
          data: { issuer: "urn:lindorm:tyr:client:abc" },
        }),
      );
    });

    // Same position as the URN, reached by a different shape — a legal issuer
    // amphora cannot discover from — which is why the refusal is named for the
    // condition (not http) rather than for one shape that meets it (a URN).
    test.each(["ftp://example.com", "ws://example.com"])(
      "a non-http URI issuer with no jwksUri: %s",
      (issuer) => {
        expect(() => validateExternalSource({ issuer })).toThrow(
          expect.objectContaining({ code: "non_http_issuer_requires_jwks_uri" }),
        );
      },
    );

    test("a source naming nothing at all", () => {
      expect(() => validateExternalSource({})).toThrow(
        expect.objectContaining({ code: "invalid_issuer_options" }),
      );
    });

    test("a jwksUri with no issuer to scope its keys by", () => {
      expect(() => validateExternalSource({ jwksUri: JWKS })).toThrow(
        expect.objectContaining({ code: "invalid_issuer_options" }),
      );
    });
  });
});
