import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { OpenIdConfiguration } from "@lindorm/openid";
import axios from "axios";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAuthDriverContext } from "../../internal/utils/auth/create-auth-driver-context.js";
import type {
  PylonAuthDriverContext,
  PylonOpenIdDriverSettings,
} from "../../types/index.js";
import { OpenIdDriver } from "./OpenIdDriver.js";

axios.defaults.proxy = false;

const ISSUER = "https://auth.lindorm.io";

describe("OpenIdDriver", () => {
  let context: PylonAuthDriverContext;
  let openIdConfiguration: Partial<OpenIdConfiguration>;
  let observed: {
    authorization?: string;
    body?: unknown;
    contentType?: string;
  };

  const createContext = (): PylonAuthDriverContext =>
    createAuthDriverContext({
      amphora: {
        idp: { config: () => ({ issuer: ISSUER, openIdConfiguration }) },
      },
      logger: createMockLogger(),
      state: {
        app: { environment: "test" },
        metadata: { correlationId: "test-correlation" },
      },
    } as any);

  const createDriver = (settings: Partial<PylonOpenIdDriverSettings> = {}) =>
    new OpenIdDriver({
      clientId: "client-id",
      clientSecret: "client-secret",
      issuer: ISSUER,
      ...settings,
    });

  const captureIntrospection = (body: object): nock.Scope =>
    nock(ISSUER)
      .post("/introspect")
      .times(1)
      .reply(200, function (_uri, requestBody) {
        observed = {
          authorization: this.req.headers["authorization"],
          body: requestBody,
          contentType: this.req.headers["content-type"],
        };
        return body;
      });

  const fields = (): Record<string, string> =>
    Object.fromEntries(new URLSearchParams(observed.body as string));

  beforeEach(() => {
    observed = {};
    nock.cleanAll();

    openIdConfiguration = {
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}/authorize`,
      tokenEndpoint: `${ISSUER}/token`,
      jwksUri: `${ISSUER}/jwks`,
      userinfoEndpoint: `${ISSUER}/userinfo`,
      introspectionEndpoint: `${ISSUER}/introspect`,
      revocationEndpoint: `${ISSUER}/revoke`,
      endSessionEndpoint: `${ISSUER}/end-session`,
    };

    context = createContext();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("endpoints", () => {
    test("should project the discovery document", async () => {
      await expect(createDriver().endpoints(context)).resolves.toMatchSnapshot();
    });

    test("should carry issuer and jwksUri", async () => {
      const endpoints = await createDriver().endpoints(context);

      expect(endpoints.issuer).toBe(ISSUER);
      expect(endpoints.jwksUri).toBe(`${ISSUER}/jwks`);
    });

    /**
     * Gap 1 — Microsoft's discovery document is served per tenant and the real
     * issuer is tenant-specific, so what the PROVIDER published wins over what
     * the operator configured. Pylon verifies id_tokens against this.
     */
    test("should prefer the discovery issuer over the configured one", async () => {
      openIdConfiguration.issuer = "https://login.example.com/tenant-abc/v2.0";

      const endpoints = await createDriver().endpoints(context);

      expect(endpoints.issuer).toBe("https://login.example.com/tenant-abc/v2.0");
    });

    test("should fall back to the configured issuer when the document omits it", async () => {
      delete openIdConfiguration.issuer;

      const endpoints = await createDriver().endpoints(context);

      expect(endpoints.issuer).toBe(ISSUER);
    });

    test("should report every absent optional endpoint as null", async () => {
      openIdConfiguration = {
        issuer: ISSUER,
        authorizationEndpoint: `${ISSUER}/authorize`,
        tokenEndpoint: `${ISSUER}/token`,
      };

      await expect(createDriver().endpoints(context)).resolves.toMatchSnapshot();
    });

    test("should throw when the document omits required metadata", async () => {
      delete openIdConfiguration.tokenEndpoint;

      await expect(createDriver().endpoints(context)).rejects.toThrow(ServerError);
    });
  });

  describe("client authentication", () => {
    const captureToken = (): nock.Scope =>
      nock(ISSUER)
        .post("/token")
        .times(1)
        .reply(200, function (_uri, requestBody) {
          observed = {
            authorization: this.req.headers["authorization"],
            body: requestBody,
            contentType: this.req.headers["content-type"],
          };
          return { access_token: "at", token_type: "Bearer" };
        });

    test("should negotiate client_secret_post from the advertised methods", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = ["client_secret_post"];
      captureToken();

      await createDriver().refresh(context, { refreshToken: "rt", scope: null });

      expect(observed.authorization).toBeUndefined();
      expect(fields().client_secret).toBe("client-secret");
    });

    // OIDC Discovery §3 / RFC 8414 §2 — nothing advertised means the spec
    // default, client_secret_basic.
    test("should fall back to client_secret_basic when the IdP advertises nothing", async () => {
      captureToken();

      await createDriver().refresh(context, { refreshToken: "rt", scope: null });

      expect(observed.authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
      expect(fields().client_secret).toBeUndefined();
    });

    // The provider advertises only methods pylon cannot compose. Sending the
    // spec default at least gives it credentials it may accept — but the
    // mismatch is real, so it is logged rather than swallowed.
    test("should warn and fall back when no advertised method can be composed", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = ["private_key_jwt"];
      captureToken();

      await createDriver().refresh(context, { refreshToken: "rt", scope: null });

      expect(observed.authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
      expect(context.logger.warn).toHaveBeenCalledWith(
        "IdP advertises no client authentication method pylon can compose",
        { fallback: "client_secret_basic", supported: ["private_key_jwt"] },
      );
    });

    // Gap 2 — a public client has no secret to present, whatever the provider
    // advertises.
    test("should authenticate a public client with client_id alone", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = ["client_secret_basic"];
      captureToken();

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
  });

  describe("userinfo", () => {
    test("should normalise the userinfo response", async () => {
      const scope = nock(ISSUER)
        .get("/userinfo")
        .matchHeader("authorization", "Bearer access-token")
        .reply(200, {
          sub: "user-123",
          given_name: "John",
          family_name: "Doe",
          email: "john@lindorm.io",
          email_verified: true,
        });

      const result = await createDriver().userinfo(context, {
        accessToken: "access-token",
      });

      expect(result).toMatchSnapshot();
      expect(scope.isDone()).toBe(true);
    });

    test("should fail by name when the IdP publishes no userinfo endpoint", async () => {
      delete openIdConfiguration.userinfoEndpoint;

      await expect(
        createDriver().userinfo(context, { accessToken: "access-token" }),
      ).rejects.toMatchObject({ code: "idp_userinfo_endpoint_not_supported" });
    });

    test("should wrap a failing userinfo request", async () => {
      nock(ISSUER).get("/userinfo").reply(500, {});

      await expect(
        createDriver().userinfo(context, { accessToken: "access-token" }),
      ).rejects.toMatchObject({ code: "userinfo_endpoint_failed" });
    });

    test("should reject a userinfo response with no subject", async () => {
      nock(ISSUER).get("/userinfo").reply(200, { given_name: "John" });

      await expect(
        createDriver().userinfo(context, { accessToken: "access-token" }),
      ).rejects.toMatchObject({ code: "userinfo_missing_subject" });
    });
  });

  describe("introspect", () => {
    // RFC 7662 §2.1 — the introspection request is form-encoded, exactly like
    // the token endpoint. JSON here is the same class of bug.
    test("should send a form-encoded snake_case body", async () => {
      const scope = captureIntrospection({ active: true, sub: "user-123" });

      await createDriver().introspect(context, { token: "access-token" });

      expect(observed.contentType).toBe("application/x-www-form-urlencoded");
      expect(observed.body).toEqual(expect.any(String));
      expect(fields()).toEqual({ token: "access-token" });
      expect(scope.isDone()).toBe(true);
    });

    test("should authenticate to the introspection endpoint", async () => {
      captureIntrospection({ active: true, sub: "user-123" });

      await createDriver().introspect(context, { token: "access-token" });

      expect(observed.authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
    });

    test("should send the token type hint", async () => {
      captureIntrospection({ active: true, sub: "user-123" });

      await createDriver().introspect(context, {
        token: "refresh-token",
        tokenTypeHint: "refresh_token",
      });

      expect(fields()).toEqual({
        token: "refresh-token",
        token_type_hint: "refresh_token",
      });
    });

    test("should normalise an active introspection", async () => {
      captureIntrospection({
        active: true,
        sub: "user-123",
        client_id: "client-abc",
        scope: "openid profile",
        token_type: "Bearer",
        username: "johndoe",
        exp: 1700003600,
      });

      const result = await createDriver().introspect(context, { token: "access-token" });

      expect(result).toMatchSnapshot();
    });

    // RFC 7662 §2.2 — an inactive token answers with nothing but `active`.
    test("should normalise an inactive introspection", async () => {
      captureIntrospection({ active: false, sub: "user-123", scope: "openid" });

      const result = await createDriver().introspect(context, { token: "access-token" });

      expect(result).toEqual({ active: false });
    });

    test("should fail by name when the IdP publishes no introspection endpoint", async () => {
      delete openIdConfiguration.introspectionEndpoint;

      await expect(
        createDriver().introspect(context, { token: "access-token" }),
      ).rejects.toMatchObject({ code: "idp_introspection_endpoint_not_supported" });
    });

    test("should wrap a failing introspection request", async () => {
      nock(ISSUER).post("/introspect").reply(500, {});

      await expect(
        createDriver().introspect(context, { token: "access-token" }),
      ).rejects.toMatchObject({ code: "introspect_endpoint_failed" });
    });
  });

  describe("subject", () => {
    test("should resolve the subject behind an opaque token", async () => {
      nock(ISSUER).get("/userinfo").reply(200, { sub: "user-123" });

      await expect(
        createDriver().subject(context, { accessToken: "opaque" }),
      ).resolves.toBe("user-123");
    });

    test("should resolve null when the IdP has no userinfo endpoint", async () => {
      delete openIdConfiguration.userinfoEndpoint;

      await expect(
        createDriver().subject(context, { accessToken: "opaque" }),
      ).resolves.toBeNull();
    });

    test("should resolve null when the userinfo request fails", async () => {
      nock(ISSUER).get("/userinfo").reply(401, {});

      await expect(
        createDriver().subject(context, { accessToken: "opaque" }),
      ).resolves.toBeNull();
    });
  });

  describe("logout", () => {
    const logoutOptions = {
      accessToken: null,
      idTokenHint: null,
      postLogoutRedirectUri: "https://app.lindorm.io/auth/logout/callback",
      refreshToken: null,
      state: "state-value",
    };

    test("should redirect when the IdP publishes an end session endpoint", async () => {
      const result = await createDriver().logout(context, logoutOptions);

      expect(result.action).toBe("redirect");

      if (result.action !== "redirect") throw new Error("Expected a redirect");

      expect(result.url.origin + result.url.pathname).toBe(`${ISSUER}/end-session`);
      expect(Object.fromEntries(result.url.searchParams)).toMatchSnapshot();
    });

    test("should carry the id_token_hint when the session has one", async () => {
      const result = await createDriver().logout(context, {
        ...logoutOptions,
        idTokenHint: "id-token",
      });

      if (result.action !== "redirect") throw new Error("Expected a redirect");

      expect(result.url.searchParams.get("id_token_hint")).toBe("id-token");
    });

    test("should merge the caller query", async () => {
      const result = await createDriver().logout(context, {
        ...logoutOptions,
        query: { uiLocales: "sv-SE" },
      });

      if (result.action !== "redirect") throw new Error("Expected a redirect");

      expect(result.url.searchParams.get("ui_locales")).toBe("sv-SE");
    });

    // OIDC RP-Initiated Logout 1.0 §2 — `end_session_endpoint` is OPTIONAL. A
    // provider without one has nothing to redirect to, which is a fact to
    // report rather than a failure.
    test("should log out locally when the IdP publishes no end session endpoint", async () => {
      delete openIdConfiguration.endSessionEndpoint;

      await expect(createDriver().logout(context, logoutOptions)).resolves.toEqual({
        action: "local",
      });
    });
  });
});
