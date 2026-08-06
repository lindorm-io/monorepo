import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import axios from "axios";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAuthDriverContext } from "../../internal/utils/auth/create-auth-driver-context.js";
import type {
  PylonAuthAuthorizeOptions,
  PylonAuthDriverContext,
  PylonAuthDriverSettings,
  PylonAuthEndpoints,
} from "../../types/index.js";
import { PylonAuthDriverBase } from "./PylonAuthDriverBase.js";

axios.defaults.proxy = false;

/**
 * A driver for a provider that publishes NO discovery document — the GitHub /
 * Discord case the whole seam exists for. `endpoints()` is a literal and every
 * OAuth2 mechanic below comes from the base.
 */
class TestDriver extends PylonAuthDriverBase {
  public async endpoints(): Promise<PylonAuthEndpoints> {
    return {
      issuer: "https://auth.lindorm.io",
      jwksUri: "https://auth.lindorm.io/jwks",
      authorizationEndpoint: "https://auth.lindorm.io/authorize",
      tokenEndpoint: "https://auth.lindorm.io/token",
      userinfoEndpoint: null,
      introspectionEndpoint: null,
      revocationEndpoint: null,
      endSessionEndpoint: null,
    };
  }
}

describe("PylonAuthDriverBase", () => {
  let context: PylonAuthDriverContext;
  let observed: {
    authorization?: string;
    body?: unknown;
    contentType?: string;
  };

  const createDriver = (settings: Partial<PylonAuthDriverSettings> = {}) =>
    new TestDriver({
      clientId: "client-id",
      clientSecret: "client-secret",
      ...settings,
    });

  const authorizeOptions = (
    overrides: Partial<PylonAuthAuthorizeOptions> = {},
  ): PylonAuthAuthorizeOptions => ({
    codeChallenge: "code-challenge",
    codeChallengeMethod: "S256",
    nonce: "nonce-value",
    redirectUri: "https://app.lindorm.io/auth/login/callback",
    state: "state-value",
    ...overrides,
  });

  const capture = (): nock.Scope =>
    nock("https://auth.lindorm.io")
      .post("/token")
      .times(1)
      .reply(200, function (_uri, requestBody) {
        observed = {
          authorization: this.req.headers["authorization"],
          body: requestBody,
          contentType: this.req.headers["content-type"],
        };
        return { access_token: "at", token_type: "Bearer", expires_in: 3600 };
      });

  const fields = (): Record<string, string> =>
    Object.fromEntries(new URLSearchParams(observed.body as string));

  beforeEach(() => {
    observed = {};
    nock.cleanAll();

    context = createAuthDriverContext({
      amphora: {},
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

  describe("pkce", () => {
    test("should default to S256", () => {
      expect(createDriver().pkce).toBe("S256");
    });

    test("should keep an explicit null so a provider can opt out", () => {
      expect(createDriver({ pkce: null }).pkce).toBeNull();
    });

    test("should keep an explicit plain", () => {
      expect(createDriver({ pkce: "plain" }).pkce).toBe("plain");
    });
  });

  describe("authorize", () => {
    test("should carry state and the code challenge onto the url", async () => {
      const url = await createDriver().authorize(context, authorizeOptions());

      expect(url).toBeInstanceOf(URL);
      expect(url.origin + url.pathname).toBe("https://auth.lindorm.io/authorize");
      expect(url.searchParams.get("state")).toBe("state-value");
      expect(url.searchParams.get("code_challenge")).toBe("code-challenge");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    });

    test("should snake_case every parameter name", async () => {
      const url = await createDriver().authorize(context, authorizeOptions());

      expect(Object.fromEntries(url.searchParams)).toMatchSnapshot();
    });

    test("should send the configured authorize defaults", async () => {
      const driver = createDriver({
        authorize: {
          acrValues: "urn:lindorm:acr:2fa",
          maxAge: "1 hour",
          prompt: "login",
          resource: "https://api.lindorm.io",
          responseType: "code",
          scope: ["openid", "profile", "offline_access"],
        },
      });

      const url = await driver.authorize(context, authorizeOptions());

      expect(url.searchParams.get("acr_values")).toBe("urn:lindorm:acr:2fa");
      expect(url.searchParams.get("max_age")).toBe("3600");
      expect(url.searchParams.get("prompt")).toBe("login");
      expect(url.searchParams.get("resource")).toBe("https://api.lindorm.io");
      expect(url.searchParams.get("scope")).toBe("openid profile offline_access");
    });

    test("should merge the caller query over the driver defaults", async () => {
      const url = await createDriver({
        authorize: { scope: ["openid"] },
      }).authorize(
        context,
        authorizeOptions({ query: { loginHint: "user@lindorm.io" } }),
      );

      expect(url.searchParams.get("login_hint")).toBe("user@lindorm.io");
      expect(url.searchParams.get("scope")).toBe("openid");
    });

    // RFC 7636 protects the code exchange — a response type that returns no
    // code has nothing to protect.
    test("should omit the code challenge when the response type carries no code", async () => {
      const url = await createDriver({
        authorize: { responseType: "id_token" },
      }).authorize(context, authorizeOptions());

      expect(url.searchParams.get("code_challenge")).toBeNull();
      expect(url.searchParams.get("code_challenge_method")).toBeNull();
    });

    test("should omit the code challenge when pylon supplies none", async () => {
      const url = await createDriver().authorize(
        context,
        authorizeOptions({ codeChallenge: null, codeChallengeMethod: null }),
      );

      expect(url.searchParams.get("code_challenge")).toBeNull();
    });
  });

  describe("exchange", () => {
    // RFC 6749 §4.1.3 — the token endpoint takes form-encoding, never JSON.
    test("should send a form-encoded snake_case body", async () => {
      const scope = capture();

      await createDriver().exchange(context, {
        code: "auth-code",
        codeVerifier: "code-verifier",
        redirectUri: "https://app.lindorm.io/auth/login/callback",
        scope: "openid profile",
      });

      expect(observed.contentType).toBe("application/x-www-form-urlencoded");
      expect(observed.body).toEqual(expect.any(String));
      expect(fields()).toEqual({
        code: "auth-code",
        code_verifier: "code-verifier",
        grant_type: "authorization_code",
        redirect_uri: "https://app.lindorm.io/auth/login/callback",
        scope: "openid profile",
      });
      expect(scope.isDone()).toBe(true);
    });

    test("should omit the verifier when the flow ran without pkce", async () => {
      capture();

      await createDriver().exchange(context, {
        code: "auth-code",
        codeVerifier: null,
        redirectUri: "https://app.lindorm.io/auth/login/callback",
        scope: null,
      });

      expect(fields().code_verifier).toBeUndefined();
      expect(fields().scope).toBeUndefined();
    });

    test("should return the camelCased token response", async () => {
      capture();

      const result = await createDriver().exchange(context, {
        code: "auth-code",
        codeVerifier: null,
        redirectUri: "https://app.lindorm.io/auth/login/callback",
        scope: null,
      });

      expect(result).toEqual({
        accessToken: "at",
        expiresIn: 3600,
        tokenType: "Bearer",
      });
    });
  });

  describe("refresh", () => {
    test("should send a form-encoded snake_case body", async () => {
      const scope = capture();

      await createDriver().refresh(context, {
        refreshToken: "refresh-token",
        scope: null,
      });

      expect(observed.contentType).toBe("application/x-www-form-urlencoded");
      expect(observed.body).toEqual(expect.any(String));
      expect(fields()).toEqual({
        grant_type: "refresh_token",
        refresh_token: "refresh-token",
      });
      expect(scope.isDone()).toBe(true);
    });

    test("should carry a narrowing scope", async () => {
      capture();

      await createDriver().refresh(context, {
        refreshToken: "refresh-token",
        scope: "openid",
      });

      expect(fields().scope).toBe("openid");
    });
  });

  describe("clientCredentials", () => {
    test("should send a form-encoded snake_case body", async () => {
      capture();

      await createDriver().clientCredentials(context, {
        resource: "https://api.lindorm.io",
        scope: "read:users",
      });

      expect(observed.contentType).toBe("application/x-www-form-urlencoded");
      expect(fields()).toEqual({
        grant_type: "client_credentials",
        resource: "https://api.lindorm.io",
        scope: "read:users",
      });
    });
  });

  describe("client authentication", () => {
    // OIDC Core §9 / RFC 6749 §2.3.1 — the secret belongs in the header.
    test("should keep client_secret_basic credentials out of the form", async () => {
      capture();

      await createDriver({ tokenEndpointAuthMethod: "client_secret_basic" }).refresh(
        context,
        { refreshToken: "rt", scope: null },
      );

      expect(observed.authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
      expect(fields().client_id).toBeUndefined();
      expect(fields().client_secret).toBeUndefined();
    });

    test("should put client_secret_post credentials in the form as snake_case", async () => {
      capture();

      await createDriver({ tokenEndpointAuthMethod: "client_secret_post" }).refresh(
        context,
        { refreshToken: "rt", scope: null },
      );

      expect(observed.authorization).toBeUndefined();
      expect(fields()).toEqual({
        client_id: "client-id",
        client_secret: "client-secret",
        grant_type: "refresh_token",
        refresh_token: "rt",
      });
    });

    // Gap 2 — GitHub Apps, native apps and PKCE-only clients have no secret.
    // RFC 6749 §3.2.1 still requires them to identify themselves.
    test("should send client_id alone for a public client with no secret", async () => {
      capture();

      await createDriver({ clientSecret: undefined }).refresh(context, {
        refreshToken: "rt",
        scope: null,
      });

      expect(observed.authorization).toBeUndefined();
      expect(fields()).toEqual({
        client_id: "client-id",
        grant_type: "refresh_token",
        refresh_token: "rt",
      });
    });

    test("should refuse to invent a secret when one is pinned but absent", async () => {
      capture();

      await createDriver({
        clientSecret: undefined,
        tokenEndpointAuthMethod: "client_secret_basic",
      }).refresh(context, { refreshToken: "rt", scope: null });

      expect(observed.authorization).toBeUndefined();
      expect(fields().client_id).toBe("client-id");
    });

    test("should throw when a pinned method cannot be composed", async () => {
      await expect(
        createDriver({ tokenEndpointAuthMethod: "private_key_jwt" }).refresh(context, {
          refreshToken: "rt",
          scope: null,
        }),
      ).rejects.toThrow(/Token endpoint auth method is not supported/);
    });
  });

  /**
   * RFC 9396 §2 — the fields inside an `authorization_details` entry are defined
   * by the schema named in `type`, MAY legitimately be camelCase, and must
   * survive BOTH directions verbatim.
   */
  describe("authorization_details", () => {
    test("should camelise the top level of the response but not the entries", async () => {
      nock("https://auth.lindorm.io")
        .post("/token")
        .reply(200, {
          access_token: "at",
          token_type: "Bearer",
          authorization_details: [
            {
              type: "payment_initiation",
              instructedAmount: { currencyCode: "EUR" },
            },
          ],
        });

      const result = await createDriver().clientCredentials(context, {
        resource: null,
        scope: null,
      });

      expect(result.authorizationDetails).toEqual([
        { type: "payment_initiation", instructedAmount: { currencyCode: "EUR" } },
      ]);
    });
  });
});
