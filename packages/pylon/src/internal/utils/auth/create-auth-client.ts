import { ServerError } from "@lindorm/errors";
import { PKCE } from "@lindorm/pkce";
import type { CodeChallengeMethod } from "@lindorm/openid";
import { randomBytes } from "crypto";
import { IntrospectionEndpointFailed } from "../../../errors/IntrospectionEndpointFailed.js";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed.js";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type {
  AuthorizeQuery,
  AuthorizeResult,
  LogoutQuery,
  LogoutResult,
  PylonAuthClient,
  PylonAuthClaimsClient,
  PylonAuthClientConfig,
  PylonAuthConfig,
  PylonAuthDriverContext,
  PylonContext,
  PylonHttpContext,
  PylonIntrospection,
  PylonIntrospectionActive,
  PylonUserinfo,
} from "../../../types/index.js";
import { assertAuthorizeUrl } from "./assert-authorize-url.js";
import { createAuthDriverContext } from "./create-auth-driver-context.js";
import { parseUserinfo } from "./parse-userinfo.js";

// --- Claims client (works on both HTTP and socket) ---

type ClaimsClientOptions = {
  ctx: PylonContext;
  driver: IPylonAuthDriver;
  driverContext: PylonAuthDriverContext;
  resolveAccessToken: () => string | null;
};

export const createClaimsClient = (
  options: ClaimsClientOptions,
): PylonAuthClaimsClient => {
  const { ctx, driver, driverContext, resolveAccessToken } = options;

  // Per-token caches: the empty string sentinel "" is the no-arg /
  // context-resolved-token entry. Explicit tokens are keyed by their value.
  const userinfoCache = new Map<string, PylonUserinfo>();
  const introspectCache = new Map<string, PylonIntrospection>();

  const userinfo = async (token?: string): Promise<PylonUserinfo> => {
    const cacheKey = token ?? "";
    const cached = userinfoCache.get(cacheKey);
    if (cached) return cached;

    // Fast path: explicit token — try local verify (id_token-style JWT).
    if (token) {
      try {
        const verified = await ctx.aegis.verify(token);
        if (verified.format === "jwt") {
          const result = parseUserinfo(verified.wire?.payload ?? {});
          userinfoCache.set(cacheKey, result);
          return result;
        }
      } catch {
        // Verification failed — fall through to the driver with the explicit token.
      }
    } else {
      // Fast path: no-arg — use the parsed id_token from context if available.
      const idToken = ctx.state.tokens?.idToken;
      if (idToken && idToken.format === "jwt") {
        const result = parseUserinfo(idToken.wire?.payload ?? {});
        userinfoCache.set(cacheKey, result);
        return result;
      }
    }

    const accessToken = token ?? resolveAccessToken();

    if (!accessToken) {
      throw new UserinfoEndpointFailed("No access token available for userinfo request", {
        code: "userinfo_access_token_missing",
        title: "Userinfo Access Token Missing",
        details:
          "No explicit token was provided and none could be resolved from the session, authorization header, or context",
      });
    }

    // The capability IS the method's presence. A driver for a provider with no
    // profile endpoint (or one pylon was never meant to call) says so by
    // omission, and the local fast paths above still work.
    if (!driver.userinfo) {
      throw new ServerError("Auth driver cannot fetch userinfo", {
        code: "driver_cannot_userinfo",
        title: "Auth Driver Cannot Fetch Userinfo",
        type: "urn:lindorm:pylon:error:driver_cannot_userinfo",
        status: ServerError.Status.NotImplemented,
        details:
          "The configured auth driver implements no `userinfo` method, so the subject's profile cannot be fetched from the provider. Only the local id_token fast path is available in this deployment.",
      });
    }

    const result = await driver.userinfo(driverContext, { accessToken });

    userinfoCache.set(cacheKey, result);
    return result;
  };

  const introspect = async (token?: string): Promise<PylonIntrospection> => {
    const cacheKey = token ?? "";
    const cached = introspectCache.get(cacheKey);
    if (cached) return cached;

    // Fast path: explicit token — try local verify first.
    if (token) {
      try {
        const verified = await ctx.aegis.verify(token);
        if (verified.format === "jwt") {
          const result: PylonIntrospectionActive = { ...verified.claims, active: true };
          introspectCache.set(cacheKey, result);
          return result;
        }
      } catch {
        // Verification failed — fall through to the driver with the explicit token.
      }
    } else {
      // Fast path: no-arg — use the parsed access token from context if available.
      const accessTokenParsed = ctx.state.tokens?.accessToken;
      if (accessTokenParsed && accessTokenParsed.format === "jwt") {
        // The domain `claims` bucket holds only the registered claims — the
        // custom-claim and profile buckets are kept separate on VerifiedToken,
        // so introspection sees neither. `confirmation` IS a registered claim
        // (PopClaims) and passes through.
        const result: PylonIntrospectionActive = {
          ...accessTokenParsed.claims,
          active: true,
        };
        introspectCache.set(cacheKey, result);
        return result;
      }
    }

    const accessToken = token ?? resolveAccessToken();

    if (!accessToken) {
      throw new IntrospectionEndpointFailed(
        "No access token available for introspection request",
        {
          code: "introspect_access_token_missing",
          title: "Introspect Access Token Missing",
          details:
            "No explicit token was provided and none could be resolved from the session, authorization header, or context",
        },
      );
    }

    // The capability IS the method's presence. An API service that only ever
    // sees locally verifiable JWTs configures a driver without `introspect`,
    // and that is the NORMAL configuration — not a broken one.
    if (!driver.introspect) {
      throw new ServerError("Auth driver cannot introspect", {
        code: "driver_cannot_introspect",
        title: "Auth Driver Cannot Introspect",
        type: "urn:lindorm:pylon:error:driver_cannot_introspect",
        status: ServerError.Status.NotImplemented,
        details:
          "The configured auth driver implements no `introspect` method (RFC 7662), so a token that cannot be verified locally cannot be resolved. Configure a driver that introspects, or accept only locally verifiable tokens.",
      });
    }

    const result = await driver.introspect(driverContext, { token: accessToken });

    introspectCache.set(cacheKey, result);
    return result;
  };

  return {
    capabilities: {
      introspect: Boolean(driver.introspect),
      userinfo: Boolean(driver.userinfo),
    },
    introspect,
    userinfo,
  };
};

// --- Full auth client (HTTP only — adds login/logout) ---

/**
 * Pylon's own PKCE default. `undefined` on the driver means "not configured";
 * `null` is the operator saying the provider rejects the parameters, and `??`
 * cannot tell the two apart.
 */
const resolvePkce = (driver: IPylonAuthDriver): CodeChallengeMethod | null =>
  driver.pkce === undefined ? "S256" : driver.pkce;

export const createAuthClient = (
  ctx: PylonHttpContext,
  config: PylonAuthConfig,
): PylonAuthClient => {
  const driverContext = createAuthDriverContext(ctx);

  const claims = createClaimsClient({
    ctx,
    driver: config.driver,
    driverContext,
    resolveAccessToken: () =>
      ctx.state.session?.accessToken ?? ctx.state.authorization?.value ?? null,
  });

  // The identity the IdP knows this pylon by. ⚠ The issuer comes from
  // `endpoints()`, not from settings: a tenant-scoped provider templates it in
  // its metadata and the concrete value is only known at runtime. The secret
  // never leaves the driver.
  const identity = async (): Promise<PylonAuthClientConfig> => {
    const endpoints = await config.driver.endpoints(driverContext);

    return { issuer: endpoints.issuer, clientId: config.driver.clientId };
  };

  const login = async (input: AuthorizeQuery = {}): Promise<AuthorizeResult> => {
    if (!config.router) {
      throw new ServerError("Auth router is not configured", {
        code: "auth_router_not_configured",
        title: "Auth Router Not Configured",
        type: "urn:lindorm:pylon:error:auth_router_not_configured",
        details:
          "ctx.auth.login() requires options.auth.router to be configured on the Pylon",
      });
    }

    if (!config.driver.authorize) {
      throw new ServerError("Auth driver cannot authorize", {
        code: "driver_cannot_authorize",
        title: "Auth Driver Cannot Authorize",
        type: "urn:lindorm:pylon:error:driver_cannot_authorize",
        details:
          "The configured auth driver implements no `authorize` method, so no login can be started",
      });
    }

    const pkce = resolvePkce(config.driver);
    const created = pkce ? PKCE.create(pkce) : null;

    const codeChallenge = created?.challenge ?? null;
    const codeChallengeMethod = created?.method ?? null;
    const codeVerifier = created?.verifier ?? null;

    const nonce = randomBytes(16).toString("base64url");
    const state = randomBytes(16).toString("base64url");

    // ⚠ Computed ONCE and returned, so the login cookie can replay the SAME
    // string to the code exchange. RFC 6749 §4.1.3 requires an exact match, and
    // building it twice from the same inputs is a match nothing enforces.
    const callbackUri = new URL(
      `${config.router.pathPrefix}/login/callback`,
      ctx.state.origin,
    ).toString();

    const redirect = await config.driver.authorize(driverContext, {
      codeChallenge,
      codeChallengeMethod,
      nonce,
      redirectUri: callbackUri,
      state,
      query: input,
    });

    const { responseType, scope } = assertAuthorizeUrl(redirect, {
      codeChallenge,
      state,
    });

    return {
      callbackUri,
      codeChallengeMethod,
      codeVerifier,
      nonce,
      redirect,
      responseType,
      scope,
      state,
    };
  };

  const logout = async (input: LogoutQuery = {}): Promise<LogoutResult> => {
    if (!config.router) {
      throw new ServerError("Auth router is not configured", {
        code: "auth_router_not_configured",
        title: "Auth Router Not Configured",
        type: "urn:lindorm:pylon:error:auth_router_not_configured",
        details:
          "ctx.auth.logout() requires options.auth.router to be configured on the Pylon",
      });
    }

    if (!config.driver.logout) {
      throw new ServerError("Auth driver cannot log out", {
        code: "driver_cannot_logout",
        title: "Auth Driver Cannot Log Out",
        type: "urn:lindorm:pylon:error:driver_cannot_logout",
        details:
          "The configured auth driver implements no `logout` method, so the session cannot be ended at the provider",
      });
    }

    const state = randomBytes(16).toString("base64url");
    const { session } = ctx.state;

    const result = await config.driver.logout(driverContext, {
      accessToken: session?.accessToken ?? null,
      idTokenHint: input.idTokenHint ?? session?.idToken ?? null,
      postLogoutRedirectUri: new URL(
        `${config.router.pathPrefix}/logout/callback`,
        ctx.state.origin,
      ).toString(),
      refreshToken: session?.refreshToken ?? null,
      state,
      query: input,
    });

    return { ...result, state };
  };

  return { ...claims, config: identity, login, logout };
};

// --- Socket claims client factory ---

export const createSocketClaimsClient = (
  ctx: PylonContext,
  config: PylonAuthConfig,
): PylonAuthClaimsClient =>
  createClaimsClient({
    ctx,
    driver: config.driver,
    driverContext: createAuthDriverContext(ctx),
    resolveAccessToken: () => ctx.state.authorization?.value ?? null,
  });
