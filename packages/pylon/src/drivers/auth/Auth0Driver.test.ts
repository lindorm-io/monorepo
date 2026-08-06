import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { OpenIdConfiguration } from "@lindorm/openid";
import axios from "axios";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAuthDriverContext } from "../../internal/utils/auth/create-auth-driver-context.js";
import type {
  PylonAuthAuthorizeOptions,
  PylonAuthDriverContext,
  PylonOpenIdDriverSettings,
} from "../../types/index.js";
import { Auth0Driver } from "./Auth0Driver.js";
import { OpenIdDriver } from "./OpenIdDriver.js";

axios.defaults.proxy = false;

const ISSUER = "https://auth.lindorm.io";

/**
 * The seam test. `Auth0Driver` must differ from `OpenIdDriver` in exactly one
 * wire parameter — if anything else moves, the seam is in the wrong place.
 */
describe("Auth0Driver", () => {
  let context: PylonAuthDriverContext;
  let openIdConfiguration: Partial<OpenIdConfiguration>;

  const settings = (
    overrides: Partial<PylonOpenIdDriverSettings> = {},
  ): PylonOpenIdDriverSettings => ({
    clientId: "client-id",
    clientSecret: "client-secret",
    issuer: ISSUER,
    authorize: { resource: "https://api.lindorm.io", scope: ["openid", "profile"] },
    ...overrides,
  });

  const options: PylonAuthAuthorizeOptions = {
    codeChallenge: "code-challenge",
    codeChallengeMethod: "S256",
    nonce: "nonce-value",
    redirectUri: "https://app.lindorm.io/auth/login/callback",
    state: "state-value",
  };

  const query = (url: URL): Record<string, string> =>
    Object.fromEntries(url.searchParams);

  beforeEach(() => {
    nock.cleanAll();

    openIdConfiguration = {
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}/authorize`,
      tokenEndpoint: `${ISSUER}/token`,
      jwksUri: `${ISSUER}/jwks`,
      endSessionEndpoint: `${ISSUER}/end-session`,
    };

    context = createAuthDriverContext({
      amphora: { idp: { config: () => ({ issuer: ISSUER, openIdConfiguration }) } },
      logger: createMockLogger(),
      state: {
        app: { environment: "test" },
        metadata: { correlationId: "test-correlation" },
      },
    } as any);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  /**
   * Auth0 tenants without the RFC 8707 Resource Parameter Compatibility Profile
   * require the proprietary `audience` parameter to issue a JWT access token.
   */
  test("should send the resource indicator as audience", async () => {
    const url = await new Auth0Driver(settings()).authorize(context, options);

    expect(url.searchParams.get("audience")).toBe("https://api.lindorm.io");
    expect(url.searchParams.get("resource")).toBeNull();
  });

  test("should change nothing else about the authorize request", async () => {
    const auth0 = query(await new Auth0Driver(settings()).authorize(context, options));
    const openid = query(await new OpenIdDriver(settings()).authorize(context, options));

    const { audience, ...auth0Rest } = auth0;
    const { resource, ...openIdRest } = openid;

    expect(audience).toBe(resource);
    expect(auth0Rest).toEqual(openIdRest);
  });

  test("should leave the request untouched when no resource is configured", async () => {
    const withoutResource = settings({ authorize: { scope: ["openid", "profile"] } });

    const auth0 = query(
      await new Auth0Driver(withoutResource).authorize(context, options),
    );
    const openid = query(
      await new OpenIdDriver(withoutResource).authorize(context, options),
    );

    expect(auth0.audience).toBeUndefined();
    expect(auth0).toEqual(openid);
  });

  test("should keep the query sorted after the swap", async () => {
    const url = await new Auth0Driver(settings()).authorize(context, options);

    expect(query(url)).toMatchSnapshot();
    expect([...url.searchParams.keys()]).toEqual([...url.searchParams.keys()].sort());
  });

  test("should inherit every other capability from OpenIdDriver", async () => {
    const driver = new Auth0Driver(settings());

    await expect(driver.endpoints(context)).resolves.toMatchObject({ issuer: ISSUER });
    await expect(
      driver.logout(context, {
        accessToken: null,
        idTokenHint: null,
        postLogoutRedirectUri: "https://app.lindorm.io/auth/logout/callback",
        refreshToken: null,
        state: "state-value",
      }),
    ).resolves.toMatchObject({ action: "redirect" });
  });
});
