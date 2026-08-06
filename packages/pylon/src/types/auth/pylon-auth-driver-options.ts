import type { TokenRequest, TokenResponse } from "@lindorm/openid";
import type { CodeChallengeMethod } from "@lindorm/openid";
import type { AuthorizeQuery, LogoutQuery } from "../http/pylon-auth-client.js";

/**
 * What every token-endpoint grant resolves to — the RFC 6749 §5.1 / OIDC Core
 * §3.1.3.3 response, camelCased. Pylon's session assembly reads exactly this,
 * so the three grants share one result type.
 */
export type PylonAuthTokenResult = TokenResponse;

/**
 * The token-endpoint request body a driver composes, minus the client
 * credentials — those are decided by the negotiated client authentication
 * method and attached by the base, never by the caller.
 */
export type PylonAuthTokenRequest = Omit<TokenRequest, "clientId" | "clientSecret">;

/**
 * Everything pylon computed and will hold the driver to. `state`, `nonce`, the
 * PKCE pair and the callback URI are pylon's, not the driver's — the driver
 * places them on the wire under whatever parameter names its provider expects.
 *
 * `codeChallenge` / `codeChallengeMethod` are `null` when PKCE does not apply
 * (a non-code response type, or a driver that declared `pkce: null`).
 */
export type PylonAuthAuthorizeOptions = {
  codeChallenge: string | null;
  codeChallengeMethod: CodeChallengeMethod | null;
  nonce: string;
  /** Computed ONCE by pylon and replayed verbatim to `exchange` (RFC 6749 §4.1.3). */
  redirectUri: string;
  state: string;
  /** Caller extras from `ctx.auth.login(query)`, merged over the driver's defaults. */
  query?: AuthorizeQuery;
};

export type PylonAuthExchangeOptions = {
  code: string;
  /** `null` when the login flow ran without PKCE. */
  codeVerifier: string | null;
  /** The SAME string handed to `authorize` — RFC 6749 §4.1.3 requires an exact match. */
  redirectUri: string;
  scope: string | null;
};

export type PylonAuthRefreshOptions = {
  refreshToken: string;
  /** RFC 6749 §6 — a narrowing scope, or `null` to keep the original grant. */
  scope: string | null;
};

export type PylonAuthClientCredentialsOptions = {
  /** RFC 8707 resource indicator, or `null`. */
  resource: string | null;
  scope: string | null;
};

export type PylonAuthIntrospectOptions = {
  token: string;
  /** RFC 7662 §2.1 `token_type_hint`. */
  tokenTypeHint?: "access_token" | "refresh_token";
};

export type PylonAuthUserinfoOptions = {
  accessToken: string;
};

export type PylonAuthSubjectOptions = {
  accessToken: string;
};

export type PylonAuthLogoutOptions = {
  /** The session's tokens, for a provider that revokes rather than redirects. */
  accessToken: string | null;
  idTokenHint: string | null;
  /** Pylon's own callback, already checked against the redirect allowlist. */
  postLogoutRedirectUri: string;
  refreshToken: string | null;
  state: string;
  /** Caller extras from `ctx.auth.logout(query)`. */
  query?: LogoutQuery;
};

/**
 * Logout is not one shape across providers. An OP with RP-initiated logout
 * wants the browser sent to its `end_session_endpoint`; Discord (RFC 7009) and
 * GitHub (`DELETE /applications/{client_id}/token`) revoke server-side and
 * leave nothing to redirect to. The union lets a driver say which happened
 * instead of pylon guessing from an endpoint's absence.
 */
export type PylonAuthLogoutResult =
  | { action: "redirect"; url: URL }
  | { action: "local" };
