import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import axios from "axios";
import nock from "nock";
import { createAuthClient } from "./create-auth-client.js";
import { getOpenIdConfiguration as _getOpenIdConfiguration } from "./get-open-id-configuration.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

axios.defaults.proxy = false;

vi.mock("./get-open-id-configuration.js");

const getOpenIdConfiguration = _getOpenIdConfiguration as Mock;

/**
 * `@lindorm/conduit` is deliberately NOT mocked here: the sibling suite mocks
 * `Conduit` wholesale, so it can only see the options handed to `post` — never
 * the encoding that actually leaves the process. RFC 6749 §4.1.3 requires the
 * token request to be `application/x-www-form-urlencoded`; Auth0 tolerates
 * JSON, which is why sending JSON went unnoticed, but Discord and others
 * reject it. These tests run a REAL Conduit and assert the wire.
 */
describe("createAuthClient — token request encoding", () => {
  let observed: {
    contentType?: string;
    authorization?: string;
    body?: unknown;
  };

  const createCtx = () => ({
    amphora: { config: [] },
    logger: createMockLogger(),
    state: {
      app: { environment: "test" },
      metadata: { correlationId: "test-corr" },
      origin: "https://app.lindorm.io",
      tokens: {},
      session: null,
      authorization: null,
    },
  });

  const createConfig = () => ({
    clientId: "client-id",
    clientSecret: "client-secret",
    issuer: "https://auth.lindorm.io",
    router: null,
  });

  const capture = (): nock.Scope =>
    nock("https://auth.lindorm.io")
      .post("/token")
      .times(1)
      .reply(200, function (_uri, requestBody) {
        observed = {
          contentType: this.req.headers["content-type"],
          authorization: this.req.headers["authorization"],
          body: requestBody,
        };
        return { access_token: "at", token_type: "Bearer", expires_in: 3600 };
      });

  const fields = (): Record<string, string> =>
    Object.fromEntries(new URLSearchParams(observed.body as string));

  const withAuthMethods = (methods: Array<string>) => {
    getOpenIdConfiguration.mockReturnValue({
      authorizationEndpoint: "https://auth.lindorm.io/authorize",
      tokenEndpoint: "https://auth.lindorm.io/token",
      tokenEndpointAuthMethodsSupported: methods,
      userinfoEndpoint: "https://auth.lindorm.io/userinfo",
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    observed = {};
    nock.cleanAll();
    withAuthMethods(["client_secret_basic"]);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test("should send the authorization_code exchange as urlencoded snake_case", async () => {
    const scope = capture();

    const client = createAuthClient(createCtx() as any, createConfig() as any);

    await client.token({
      grantType: "authorization_code",
      code: "auth-code",
      redirectUri: "https://app.lindorm.io/auth/login/callback",
      codeVerifier: "code-verifier",
      scope: "openid profile",
    } as any);

    expect(observed.contentType).toBe("application/x-www-form-urlencoded");
    expect(observed.body).toEqual(expect.any(String));
    expect(fields()).toEqual({
      grant_type: "authorization_code",
      code: "auth-code",
      redirect_uri: "https://app.lindorm.io/auth/login/callback",
      code_verifier: "code-verifier",
      scope: "openid profile",
    });
    expect(scope.isDone()).toBe(true);
  });

  test("should send the refresh_token grant as urlencoded snake_case", async () => {
    const scope = capture();

    const client = createAuthClient(createCtx() as any, createConfig() as any);

    await client.token({
      grantType: "refresh_token",
      refreshToken: "refresh-token",
    } as any);

    expect(observed.contentType).toBe("application/x-www-form-urlencoded");
    expect(fields()).toEqual({
      grant_type: "refresh_token",
      refresh_token: "refresh-token",
    });
    expect(scope.isDone()).toBe(true);
  });

  test("should keep client_secret_basic credentials in the header, not the form", async () => {
    const scope = capture();

    const client = createAuthClient(createCtx() as any, createConfig() as any);

    await client.token({ grantType: "refresh_token", refreshToken: "rt" } as any);

    expect(observed.contentType).toBe("application/x-www-form-urlencoded");
    expect(observed.authorization).toBe(
      `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
    );
    expect(fields().client_id).toBeUndefined();
    expect(fields().client_secret).toBeUndefined();
    expect(scope.isDone()).toBe(true);
  });

  test("should put client_secret_post credentials in the form as snake_case", async () => {
    withAuthMethods(["client_secret_post"]);

    const scope = capture();

    const client = createAuthClient(createCtx() as any, createConfig() as any);

    await client.token({
      grantType: "authorization_code",
      code: "auth-code",
    } as any);

    expect(observed.contentType).toBe("application/x-www-form-urlencoded");
    expect(observed.authorization).toBeUndefined();
    expect(fields()).toEqual({
      grant_type: "authorization_code",
      code: "auth-code",
      client_id: "client-id",
      client_secret: "client-secret",
    });
    expect(scope.isDone()).toBe(true);
  });

  // OIDC Discovery §3 / RFC 8414 §2 — nothing advertised means the spec
  // default, `client_secret_basic`.
  test("should fall back to client_secret_basic when the IdP advertises nothing", async () => {
    getOpenIdConfiguration.mockReturnValue({
      authorizationEndpoint: "https://auth.lindorm.io/authorize",
      tokenEndpoint: "https://auth.lindorm.io/token",
      userinfoEndpoint: "https://auth.lindorm.io/userinfo",
    });

    const scope = capture();

    const client = createAuthClient(createCtx() as any, createConfig() as any);

    await client.token({ grantType: "refresh_token", refreshToken: "rt" } as any);

    expect(observed.contentType).toBe("application/x-www-form-urlencoded");
    expect(observed.authorization).toBe(
      `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
    );
    expect(fields().client_id).toBeUndefined();
    expect(scope.isDone()).toBe(true);
  });
});
