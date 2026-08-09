import type { Conduit } from "@lindorm/conduit";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { OpenIdConfiguration } from "@lindorm/openid";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, expectTypeOf, test } from "vitest";
import { OPEN_ID_CONFIGURATION_RESPONSE } from "../../__fixtures__/auth0.js";
import { AmphoraError } from "../../errors/index.js";
import { createExternalConduit } from "./create-external-conduit.js";
import { resolveExternalConfig } from "./resolve-external-config.js";

const AUTH0 = "https://lindorm.eu.auth0.com";
const OIDCONF = "/.well-known/openid-configuration";

/**
 * Resolution settles `issuer` / `jwksUri` / `openIdConfiguration` and nothing else,
 * so those three are ALL it returns — in the type and in the value.
 *
 * The rest of an entry cannot be resolved: `input` alone says neither which scope a
 * source was registered in nor whether the idp is required, and `keyCount` /
 * `lastRefresh` / `lastAccess` belong to the JWKS fetch. A wider return would hand
 * back `scope: "external"` and `required: false` for the IDP — an optional external
 * where the upstream provider should be — and zeroed bookkeeping that a refresh
 * would write over a live entry's.
 */
const RESOLVED_FIELDS = ["issuer", "jwksUri", "openIdConfiguration"];

describe("resolveExternalConfig", () => {
  let conduit: Conduit;

  beforeEach(() => {
    const logger = createMockLogger();
    conduit = createExternalConduit({ logger }, logger);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("returns only what it resolves", () => {
    test("should settle a direct issuer + jwksUri without carrying seeded fields", async () => {
      const resolved = await resolveExternalConfig(conduit, {
        issuer: "urn:lindorm:test",
        jwksUri: `${AUTH0}/.well-known/jwks.json`,
        required: true,
      });

      expect(Object.keys(resolved).sort()).toEqual(RESOLVED_FIELDS);
      expect(resolved).toMatchSnapshot();
    });

    test("should not hand back a scope or a required flag for an idp source", async () => {
      nock(AUTH0).get(OIDCONF).reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

      // An idp source verbatim: AmphoraIdpSettings has no `required` to declare,
      // and nothing in it says which scope it was registered in. A seeded return
      // would answer both questions anyway — with "external" and `false`.
      const resolved = await resolveExternalConfig(conduit, {
        openIdConfigurationUri: `${AUTH0}${OIDCONF}`,
      });

      expect(Object.keys(resolved).sort()).toEqual(RESOLVED_FIELDS);
      expect(resolved).not.toHaveProperty("scope");
      expect(resolved).not.toHaveProperty("required");
    });

    test("should not hand back the zeroed key bookkeeping a refresh would clobber", async () => {
      nock(AUTH0).get(OIDCONF).reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

      // The refresh path re-resolves an entry that already holds keys. Seeded
      // `keyCount: 0` / `lastRefresh: null` / `lastAccess: null` are stale the
      // moment they are returned.
      const resolved = await resolveExternalConfig(conduit, { issuer: `${AUTH0}/` });

      expect(Object.keys(resolved).sort()).toEqual(RESOLVED_FIELDS);
      expect(resolved).not.toHaveProperty("input");
      expect(resolved).not.toHaveProperty("keyCount");
      expect(resolved).not.toHaveProperty("lastRefresh");
      expect(resolved).not.toHaveProperty("lastAccess");
    });
  });

  describe("resolution", () => {
    test("should derive issuer + jwksUri from an explicit discovery uri", async () => {
      nock(AUTH0).get(OIDCONF).reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

      const resolved = await resolveExternalConfig(conduit, {
        openIdConfigurationUri: `${AUTH0}${OIDCONF}`,
      });

      expect(resolved.issuer).toBe(`${AUTH0}/`);
      expect(resolved.jwksUri).toBe(`${AUTH0}/.well-known/jwks.json`);
      expect(resolved.openIdConfiguration).toEqual(
        expect.objectContaining({ issuer: `${AUTH0}/` }),
      );
    });

    test("should discover from a url issuer that names no jwksUri", async () => {
      nock(AUTH0).get(OIDCONF).reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

      const resolved = await resolveExternalConfig(conduit, { issuer: `${AUTH0}/` });

      expect(resolved.issuer).toBe(`${AUTH0}/`);
      expect(resolved.jwksUri).toBe(`${AUTH0}/.well-known/jwks.json`);
    });

    test("should keep a direct source's null openIdConfiguration", async () => {
      const resolved = await resolveExternalConfig(conduit, {
        issuer: "urn:lindorm:test",
        jwksUri: `${AUTH0}/.well-known/jwks.json`,
      });

      expect(resolved.openIdConfiguration).toBeNull();
    });

    test("should throw when a discovery document yields no issuer", async () => {
      nock(AUTH0).get(OIDCONF).reply(200, {});

      await expect(
        resolveExternalConfig(conduit, {
          openIdConfigurationUri: `${AUTH0}${OIDCONF}`,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "external_issuer_unresolved" }));
    });
  });

  describe("precondition", () => {
    // Registration validates first, so an invalid source cannot reach here through
    // amphora. Asserting it again is what keeps the branches below free of the
    // question — and keeps the specific error code rather than the catch-all.
    test("should reject a non-uri issuer", async () => {
      await expect(
        resolveExternalConfig(conduit, { issuer: "not-a-uri" }),
      ).rejects.toThrow(expect.objectContaining({ code: "external_issuer_not_uri" }));
    });

    test("should reject a urn issuer with no jwksUri", async () => {
      await expect(
        resolveExternalConfig(conduit, { issuer: "urn:lindorm:test" }),
      ).rejects.toThrow(
        expect.objectContaining({ code: "non_http_issuer_requires_jwks_uri" }),
      );
    });

    // A URI, not a URN, with an authority — so the URN-shaped rule let it
    // through and discovery derived `ftp://example.com/.well-known/...`, a legal
    // URL no client can fetch. Same position as the URN, same refusal.
    test("should reject a non-http uri issuer with no jwksUri", async () => {
      await expect(
        resolveExternalConfig(conduit, { issuer: "ftp://example.com" }),
      ).rejects.toThrow(
        expect.objectContaining({ code: "non_http_issuer_requires_jwks_uri" }),
      );
    });

    // The discovery uri is FETCHED, so it is held to the same rule. No nock
    // interceptor is registered: had this been accepted, the request itself
    // would have failed instead — which is the fetch-time failure registration
    // exists to pre-empt.
    test("should reject a non-http discovery uri", async () => {
      await expect(
        resolveExternalConfig(conduit, { openIdConfigurationUri: "foo:bar" }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "external_openid_configuration_uri_not_http_url",
        }),
      );
    });

    test("should reject a non-http jwksUri", async () => {
      await expect(
        resolveExternalConfig(conduit, { issuer: `${AUTH0}/`, jwksUri: "foo:bar" }),
      ).rejects.toThrow(
        expect.objectContaining({ code: "external_jwks_uri_not_http_url" }),
      );
    });

    test("should reject a source naming nothing usable", async () => {
      await expect(resolveExternalConfig(conduit, {})).rejects.toThrow(AmphoraError);
    });
  });

  describe("type", () => {
    test("should declare only the resolved fields", async () => {
      const resolved = await resolveExternalConfig(conduit, {
        issuer: "urn:lindorm:test",
        jwksUri: `${AUTH0}/.well-known/jwks.json`,
      });

      expectTypeOf(resolved).toEqualTypeOf<{
        issuer: string;
        jwksUri: string | null;
        openIdConfiguration: Partial<OpenIdConfiguration> | null;
      }>();

      // The trap this closes: a caller widening the return, spreading it, or
      // reading a field off it got `scope: "external"` / `required: false` —
      // both wrong for the idp — and stale key bookkeeping.
      expectTypeOf(resolved).not.toHaveProperty("scope");
      expectTypeOf(resolved).not.toHaveProperty("required");
      expectTypeOf(resolved).not.toHaveProperty("input");
      expectTypeOf(resolved).not.toHaveProperty("keyCount");
      expectTypeOf(resolved).not.toHaveProperty("lastRefresh");
      expectTypeOf(resolved).not.toHaveProperty("lastAccess");
    });
  });
});
