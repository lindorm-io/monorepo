import { Aegis, JwtKit } from "@lindorm/aegis";
import { Amphora } from "@lindorm/amphora";
import type { IKryptos } from "@lindorm/kryptos";
import { KryptosKit } from "@lindorm/kryptos";
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
  public endpoints(): PylonAuthEndpoints {
    return {
      issuer: "https://auth.lindorm.io",
      authorizationEndpoint: "https://auth.lindorm.io/authorize",
      tokenEndpoint: "https://auth.lindorm.io/token",
      userinfoEndpoint: null,
      introspectionEndpoint: null,
      revocationEndpoint: null,
      endSessionEndpoint: null,
    };
  }
}

/**
 * `authorizationEndpoint` and `tokenEndpoint` are `string | null` on the surface
 * so a VERIFY-ONLY driver can state that its provider has neither. This base IS
 * the relying party, so reaching it with either missing is a misconfiguration
 * that must fail by name rather than request `null`.
 */
class EndpointlessDriver extends PylonAuthDriverBase {
  public endpoints(): PylonAuthEndpoints {
    return {
      issuer: "https://auth.lindorm.io",
      authorizationEndpoint: null,
      tokenEndpoint: null,
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

    // A REAL aegis over a real (empty) vault: the assertion methods mint through
    // it, and an injected key is the one thing that never touches the vault, so
    // nothing needs to be registered for this to be honest.
    const logger = createMockLogger();
    const amphora = new Amphora({ logger });

    context = createAuthDriverContext({
      aegis: new Aegis({ amphora, logger }),
      amphora,
      logger,
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

  describe("missing endpoints", () => {
    const endpointless = (): EndpointlessDriver =>
      new EndpointlessDriver({ clientId: "client-id", clientSecret: "client-secret" });

    test("should refuse to authorize against a provider with no authorization endpoint", async () => {
      await expect(
        endpointless().authorize(context, authorizeOptions()),
      ).rejects.toMatchObject({
        code: "idp_authorization_endpoint_not_supported",
        type: "urn:lindorm:pylon:error:idp_authorization_endpoint_not_supported",
      });
    });

    // Every grant this base runs POSTs to the token endpoint, so a provider
    // without one supports none of them.
    test("should refuse to run a grant against a provider with no token endpoint", async () => {
      await expect(
        endpointless().refresh(context, { refreshToken: "rt", scope: null }),
      ).rejects.toMatchObject({
        code: "idp_token_endpoint_not_supported",
        type: "urn:lindorm:pylon:error:idp_token_endpoint_not_supported",
      });
    });

    // It fails BEFORE composing credentials — nothing reaches the wire.
    test("should send nothing when it has no token endpoint", async () => {
      const scope = nock("https://auth.lindorm.io").post("/token").reply(200, {});

      await expect(
        endpointless().exchange(context, {
          code: "code",
          codeVerifier: null,
          redirectUri: "https://app.lindorm.io/auth/login/callback",
          scope: null,
        }),
      ).rejects.toMatchObject({ code: "idp_token_endpoint_not_supported" });

      expect(scope.isDone()).toBe(false);
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
   * RFC 7523 §2.2 / OIDC Core §9 — the two assertion methods. Both send
   * `client_assertion_type=…:jwt-bearer` plus a signed `client_assertion`; they
   * differ only in what signs it.
   */
  describe("assertion client authentication", () => {
    // OIDC Core §16.19 — a client_secret used for symmetric signatures must
    // carry at least the octets the MAC algorithm requires (16 for HS256).
    const SECRET = "a-client-secret-of-at-least-16-bytes";
    const ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
    const TOKEN_ENDPOINT = "https://auth.lindorm.io/token";

    let assertionKey: IKryptos;

    /** The secret as OIDC Core §9 defines the MAC key: its UTF-8 octets, raw. */
    const secretKey = (secret: string = SECRET): IKryptos =>
      KryptosKit.from.utf({
        id: "client-id",
        algorithm: "HS256",
        privateKey: secret,
        type: "oct",
        use: "sig",
      });

    const assertion = () => JwtKit.decode(fields().client_assertion);

    const captureMany = (times: number): Array<string> => {
      const bodies: Array<string> = [];

      nock("https://auth.lindorm.io")
        .post("/token")
        .times(times)
        .reply(200, function (_uri, requestBody) {
          bodies.push(requestBody as string);
          return { access_token: "at", token_type: "Bearer" };
        });

      return bodies;
    };

    beforeEach(() => {
      assertionKey = KryptosKit.generate.sig.ec({ algorithm: "ES256" });
    });

    describe("client_secret_jwt", () => {
      test("should send the assertion parameters instead of the secret", async () => {
        const scope = capture();

        await createDriver({
          clientSecret: SECRET,
          tokenEndpointAuthMethod: "client_secret_jwt",
        }).refresh(context, { refreshToken: "rt", scope: null });

        expect(scope.isDone()).toBe(true);
        expect(observed.authorization).toBeUndefined();
        expect(fields().client_secret).toBeUndefined();
        expect(fields().client_assertion_type).toBe(ASSERTION_TYPE);
        expect(fields().client_assertion).toEqual(expect.any(String));
        // RFC 7521 §4.2 leaves `client_id` optional beside an assertion, but
        // OIDC Core §9's own example sends it and providers key on it.
        expect(fields().client_id).toBe("client-id");
      });

      // RFC 7523 §3 (1)(2)(3)(4)(7), narrowed by OIDC Core §9: iss == sub ==
      // client_id, aud == the token endpoint, jti and exp both REQUIRED.
      test("should carry the claims RFC 7523 §3 requires", async () => {
        capture();

        await createDriver({
          clientSecret: SECRET,
          tokenEndpointAuthMethod: "client_secret_jwt",
        }).refresh(context, { refreshToken: "rt", scope: null });

        const { header, payload } = assertion();

        expect(payload.iss).toBe("client-id");
        expect(payload.sub).toBe("client-id");
        expect(payload.aud).toEqual([TOKEN_ENDPOINT]);
        expect(payload.jti).toEqual(expect.any(String));
        expect(payload.exp).toEqual(expect.any(Number));
        expect(payload.iat).toEqual(expect.any(Number));
        // The default lifetime — short, because OIDC Core §9 has the token used
        // once.
        expect(payload.exp! - payload.iat!).toBe(60);
        // OIDC Core §9 — "an HMAC SHA algorithm, such as HMAC SHA-256".
        expect(header.alg).toBe("HS256");
      });

      test("should honour a configured assertion expiry", async () => {
        capture();

        await createDriver({
          clientAssertion: { expiry: "30 seconds" },
          clientSecret: SECRET,
          tokenEndpointAuthMethod: "client_secret_jwt",
        }).refresh(context, { refreshToken: "rt", scope: null });

        const { payload } = assertion();

        expect(payload.exp! - payload.iat!).toBe(30);
      });

      // The MAC must be real: the provider reproduces it from the octets of the
      // secret it already holds (OIDC Core §9), so the same octets must verify.
      test("should produce an assertion that verifies against the secret", async () => {
        capture();

        await createDriver({
          clientSecret: SECRET,
          tokenEndpointAuthMethod: "client_secret_jwt",
        }).refresh(context, { refreshToken: "rt", scope: null });

        const verified = await context.aegis.jwt.verify(
          fields().client_assertion,
          undefined,
          { key: { kryptos: secretKey() } },
        );

        expect(verified.payload.iss).toBe("client-id");
        expect(verified.payload.sub).toBe("client-id");
      });

      test("should produce an assertion that does NOT verify against another secret", async () => {
        capture();

        await createDriver({
          clientSecret: SECRET,
          tokenEndpointAuthMethod: "client_secret_jwt",
        }).refresh(context, { refreshToken: "rt", scope: null });

        await expect(
          context.aegis.jwt.verify(fields().client_assertion, undefined, {
            key: { kryptos: secretKey("a-DIFFERENT-secret-of-16-plus-bytes") },
          }),
        ).rejects.toThrow();
      });

      // OIDC Core §16.19 / the HMAC key-size floor. A secret too short to be a
      // MAC key is refused rather than stretched into one the provider could
      // never reproduce.
      test("should refuse a secret shorter than the MAC algorithm requires", async () => {
        await expect(
          createDriver({
            clientSecret: "too-short",
            tokenEndpointAuthMethod: "client_secret_jwt",
          }).refresh(context, { refreshToken: "rt", scope: null }),
        ).rejects.toThrow(/Invalid oct secret size/);
      });
    });

    describe("private_key_jwt", () => {
      test("should send the assertion parameters", async () => {
        const scope = capture();

        await createDriver({
          clientAssertion: { key: { kryptos: assertionKey } },
          tokenEndpointAuthMethod: "private_key_jwt",
        }).refresh(context, { refreshToken: "rt", scope: null });

        expect(scope.isDone()).toBe(true);
        expect(observed.authorization).toBeUndefined();
        expect(fields().client_secret).toBeUndefined();
        expect(fields().client_assertion_type).toBe(ASSERTION_TYPE);
        expect(fields().client_assertion).toEqual(expect.any(String));
        expect(fields().client_id).toBe("client-id");
      });

      test("should carry the claims RFC 7523 §3 requires", async () => {
        capture();

        await createDriver({
          clientAssertion: { key: { kryptos: assertionKey } },
          tokenEndpointAuthMethod: "private_key_jwt",
        }).refresh(context, { refreshToken: "rt", scope: null });

        const { header, payload } = assertion();

        expect(payload.iss).toBe("client-id");
        expect(payload.sub).toBe("client-id");
        expect(payload.aud).toEqual([TOKEN_ENDPOINT]);
        expect(payload.jti).toEqual(expect.any(String));
        expect(payload.exp! - payload.iat!).toBe(60);
        // The algorithm comes from the key itself, never from a setting that
        // could disagree with it.
        expect(header.alg).toBe("ES256");
        // OIDC Core §10.1 — the signing key MUST be findable from what the RP
        // published, and `kid` is how the provider finds it.
        expect(header.kid).toBe(assertionKey.id);
      });

      // The whole point of the method: the provider holds only the PUBLIC half,
      // so the public half alone must be enough to verify.
      test("should produce an assertion that verifies against the public key alone", async () => {
        capture();

        await createDriver({
          clientAssertion: { key: { kryptos: assertionKey } },
          tokenEndpointAuthMethod: "private_key_jwt",
        }).refresh(context, { refreshToken: "rt", scope: null });

        const publicKey = KryptosKit.from.jwk(assertionKey.toJWK("public"));

        expect(publicKey.hasPrivateKey).toBe(false);

        const verified = await context.aegis.jwt.verify(
          fields().client_assertion,
          undefined,
          { key: { kryptos: publicKey } },
        );

        expect(verified.payload.iss).toBe("client-id");
      });

      // Pinning private_key_jwt on a driver that names no key is caught during
      // negotiation, before anything is signed — the compose-layer guard behind
      // it is exercised in `resolve-client-authentication.test.ts`.
      test("should refuse to fall back to a secret when the key is missing", async () => {
        await expect(
          createDriver({
            clientSecret: SECRET,
            tokenEndpointAuthMethod: "private_key_jwt",
          }).refresh(context, { refreshToken: "rt", scope: null }),
        ).rejects.toThrow(/Token endpoint auth method is not supported/);
      });
    });

    // OIDC Core §9 — "These tokens MUST only be used once". A repeated `jti` is
    // a replay the provider is entitled to refuse, so it must be fresh per
    // request rather than per driver.
    test("should mint a fresh jti for every request", async () => {
      const bodies = captureMany(2);

      const driver = createDriver({
        clientAssertion: { key: { kryptos: assertionKey } },
        tokenEndpointAuthMethod: "private_key_jwt",
      });

      await driver.refresh(context, { refreshToken: "rt", scope: null });
      await driver.refresh(context, { refreshToken: "rt", scope: null });

      const ids = bodies.map(
        (body) =>
          JwtKit.decode(Object.fromEntries(new URLSearchParams(body)).client_assertion)
            .payload.jti,
      );

      expect(ids).toHaveLength(2);
      expect(ids[0]).toEqual(expect.any(String));
      expect(ids[0]).not.toBe(ids[1]);
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
