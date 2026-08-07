import { Aegis, JwtKit } from "@lindorm/aegis";
import { Amphora } from "@lindorm/amphora";
import { ServerError } from "@lindorm/errors";
import type { IKryptos } from "@lindorm/kryptos";
import { KryptosKit } from "@lindorm/kryptos";
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
  let idpIssuer: string;
  let openIdConfiguration: Partial<OpenIdConfiguration>;
  let observed: {
    authorization?: string;
    body?: unknown;
    contentType?: string;
  };

  /**
   * The amphora `idp` stands in for a REGISTERED and RESOLVED upstream: both
   * the issuer amphora settled on and the document it fetched. Those are two
   * separate fields on `AmphoraExternalConfig`, and the driver reads the
   * issuer from the first — never re-deriving it from the second.
   */
  const createContext = (): PylonAuthDriverContext => {
    const logger = createMockLogger();

    return createAuthDriverContext({
      aegis: new Aegis({ amphora: new Amphora({ logger }), logger }),
      amphora: {
        idp: { config: () => ({ issuer: idpIssuer, openIdConfiguration }) },
      },
      logger,
      state: {
        app: { environment: "test" },
        metadata: { correlationId: "test-correlation" },
      },
    } as any);
  };

  const createDriver = (settings: Partial<PylonOpenIdDriverSettings> = {}) =>
    new OpenIdDriver({
      clientId: "client-id",
      clientSecret: "client-secret",
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

    idpIssuer = ISSUER;

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
    test("should project the discovery document", () => {
      expect(createDriver().endpoints(context)).toMatchSnapshot();
    });

    // The sync signature IS the boundary: every fetch happened at
    // `amphora.setup()`, so there is nothing left here to await. Asserted on
    // the value, not on a resolved promise — a driver that went async would
    // hand back a `Promise` and fail this outright.
    test("should resolve endpoints without awaiting anything", () => {
      const endpoints = createDriver().endpoints(context);

      expect(endpoints).not.toBeInstanceOf(Promise);
      expect(endpoints.issuer).toBe(ISSUER);
    });

    /**
     * Gap 1 — Microsoft's discovery document is served per tenant and the real
     * issuer is tenant-specific, so what the PROVIDER published wins over what
     * the operator configured. That preference is AMPHORA's
     * (`resolveExternalConfig` takes `openIdConfiguration.issuer ?? input.issuer`),
     * and the driver carries the value amphora settled on. Pylon verifies
     * id_tokens against this, and amphora filed the fetched keys under the same
     * string — re-deriving it here could disagree with where the keys live.
     */
    test("should carry the issuer amphora resolved, not the document's", () => {
      idpIssuer = "https://login.example.com/tenant-abc/v2.0";
      openIdConfiguration.issuer = "https://login.example.com/{tenantid}/v2.0";

      const endpoints = createDriver().endpoints(context);

      expect(endpoints.issuer).toBe("https://login.example.com/tenant-abc/v2.0");
    });

    test("should report every absent optional endpoint as null", () => {
      openIdConfiguration = {
        issuer: ISSUER,
        authorizationEndpoint: `${ISSUER}/authorize`,
        tokenEndpoint: `${ISSUER}/token`,
      };

      expect(createDriver().endpoints(context)).toMatchSnapshot();
    });

    // `jwks_uri` is amphora's business — it fetches and caches the keys — so it
    // is not on the driver surface at all. A member nothing reads is worse than
    // no member: it reads as configuring verification while doing nothing.
    test("should publish no jwksUri", () => {
      expect(createDriver().endpoints(context)).not.toHaveProperty("jwksUri");
    });

    test("should throw when the document omits required metadata", () => {
      delete openIdConfiguration.tokenEndpoint;

      expect(() => createDriver().endpoints(context)).toThrow(ServerError);
    });
  });

  describe("client authentication", () => {
    const ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
    // OIDC Core §16.19 — long enough to be an HS256 MAC key.
    const SECRET = "a-client-secret-of-at-least-16-bytes";

    let assertionKey: IKryptos;

    beforeEach(() => {
      assertionKey = KryptosKit.generate.sig.ec({ algorithm: "ES256" });
    });

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

    // The provider advertises only RFC 8705 mTLS, which proves a client
    // certificate during the TLS handshake rather than by a signature — nothing
    // this seam can compose. Sending the spec default at least gives the
    // provider credentials it may accept, but the mismatch is real, so it is
    // logged rather than swallowed.
    test("should warn and fall back when no advertised method can be composed", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = ["tls_client_auth"];
      captureToken();

      await createDriver().refresh(context, { refreshToken: "rt", scope: null });

      expect(observed.authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
      expect(context.logger.warn).toHaveBeenCalledWith(
        "IdP advertises no client authentication method pylon can compose",
        {
          composable: ["client_secret_jwt", "client_secret_basic", "client_secret_post"],
          fallback: "client_secret_basic",
          supported: ["tls_client_auth"],
        },
      );
    });

    // The same fall-through for a method pylon CAN spell but this driver cannot
    // compose: `private_key_jwt` needs a `clientAssertion.key`, and a driver
    // that names none must not quietly sign with whatever the deployment uses.
    test("should warn and fall back when private_key_jwt is advertised but no assertion key is configured", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = ["private_key_jwt"];
      captureToken();

      await createDriver().refresh(context, { refreshToken: "rt", scope: null });

      expect(observed.authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
      expect(context.logger.warn).toHaveBeenCalledWith(
        "IdP advertises no client authentication method pylon can compose",
        {
          composable: ["client_secret_jwt", "client_secret_basic", "client_secret_post"],
          fallback: "client_secret_basic",
          supported: ["private_key_jwt"],
        },
      );
    });

    // Negotiation is by what a compromise costs: asymmetric proof outranks a
    // shared secret, and a MAC'd assertion outranks putting the secret itself
    // on the wire.
    test("should negotiate private_key_jwt when the IdP advertises it and a key is configured", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = [
        "client_secret_basic",
        "client_secret_jwt",
        "client_secret_post",
        "private_key_jwt",
      ];
      captureToken();

      await createDriver({
        clientAssertion: { key: { kryptos: assertionKey } },
      }).refresh(context, { refreshToken: "rt", scope: null });

      expect(observed.authorization).toBeUndefined();
      expect(fields().client_secret).toBeUndefined();
      expect(fields().client_assertion_type).toBe(ASSERTION_TYPE);
      expect(JwtKit.decode(fields().client_assertion).header.kid).toBe(assertionKey.id);
    });

    test("should negotiate client_secret_jwt over the plaintext-secret methods", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = [
        "client_secret_basic",
        "client_secret_jwt",
        "client_secret_post",
      ];
      captureToken();

      await createDriver({
        clientAssertion: { key: { kryptos: assertionKey } },
        clientSecret: SECRET,
      }).refresh(context, { refreshToken: "rt", scope: null });

      expect(observed.authorization).toBeUndefined();
      expect(fields().client_secret).toBeUndefined();
      expect(fields().client_assertion_type).toBe(ASSERTION_TYPE);
      // OIDC Core §9 — the MAC key is the secret's UTF-8 octets, so the `kid`
      // names the client rather than a key the provider could look up.
      expect(JwtKit.decode(fields().client_assertion).header.alg).toBe("HS256");
    });

    // RFC 7662 §2.1 — the introspection request authenticates too, so it
    // composes the same assertion the token endpoint does.
    test("should authenticate introspection with an assertion", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = ["private_key_jwt"];
      captureIntrospection({ active: true });

      await createDriver({
        clientAssertion: { key: { kryptos: assertionKey } },
      }).introspect(context, { token: "at" });

      expect(observed.authorization).toBeUndefined();
      expect(fields().client_assertion_type).toBe(ASSERTION_TYPE);
      // ⚠ `aud` is the TOKEN endpoint even here: RFC 7523 §3 wants a value
      // identifying the authorization SERVER, and OIDC Core §9 names the token
      // endpoint URL as that value.
      expect(JwtKit.decode(fields().client_assertion).payload.aud).toEqual([
        `${ISSUER}/token`,
      ]);
    });

    // RFC 8414 §2 — the introspection endpoint carries its own methods list, and
    // a provider may advertise a different set there. Negotiating introspection
    // from the token endpoint's list presents a method that endpoint never
    // offered.
    test("should negotiate introspection from the introspection endpoint's own methods", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = ["private_key_jwt"];
      openIdConfiguration.introspectionEndpointAuthMethodsSupported = [
        "client_secret_basic",
      ];
      captureIntrospection({ active: true });

      await createDriver({
        clientAssertion: { key: { kryptos: assertionKey } },
      }).introspect(context, { token: "at" });

      expect(observed.authorization).toEqual(expect.stringContaining("Basic "));
      expect(fields().client_assertion_type).toBeUndefined();
    });

    // The documented fallback: no introspection-specific list means the endpoint
    // authenticates like the token endpoint.
    test("should fall back to the token endpoint's methods when none are published", async () => {
      openIdConfiguration.tokenEndpointAuthMethodsSupported = ["private_key_jwt"];
      openIdConfiguration.introspectionEndpointAuthMethodsSupported = undefined;
      captureIntrospection({ active: true });

      await createDriver({
        clientAssertion: { key: { kryptos: assertionKey } },
      }).introspect(context, { token: "at" });

      expect(fields().client_assertion_type).toBe(ASSERTION_TYPE);
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
