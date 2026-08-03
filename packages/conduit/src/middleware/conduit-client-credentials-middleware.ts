import { buildDpopProof } from "../internal/build-dpop-proof.js";
import { BadGatewayError, InternalServerError } from "@lindorm/errors";
import { isArray, isString } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { OpenIdConfiguration, TokenRequest, TokenResponse } from "@lindorm/openid";
import type { Dict, DpopSigner } from "@lindorm/types";
import { Conduit } from "../classes/index.js";
import type { ConduitMiddleware, ConduitRequestOptions } from "../types/index.js";
import { conduitBasicAuthMiddleware } from "./conduit-basic-auth-middleware.js";
import { conduitBearerAuthMiddleware } from "./conduit-bearer-auth-middleware.js";
import { conduitChangeRequestBodyMiddleware } from "./conduit-change-request-body-middleware.js";
import { conduitChangeResponseDataMiddleware } from "./conduit-change-response-data-middleware.js";
import { createConduitDpopAuthMiddleware } from "./conduit-dpop-auth-middleware.js";

export type ClientCredentialsAuthLocation = "body" | "header";

export type ClientCredentialsContentType =
  | "application/json"
  | "application/x-www-form-urlencoded";

export type ConduitClientCredentialsConfig = {
  authLocation?: ClientCredentialsAuthLocation;
  clientId: string;
  clientSecret: string;
  clockTolerance?: number;
  contentType?: ClientCredentialsContentType;
  defaultExpiration?: number;
  dpopSigner?: DpopSigner;
  grantType?: "client_credentials";
  issuer: string;
  tokenUri?: string;
};

export type ConduitClientCredentialsOptions = {
  /**
   * RFC 8707 resource indicator — the target service the issued access token
   * should be audienced to. Sent verbatim as the `resource` token request
   * parameter. Conduit speaks the RFC spelling only; an authorization server
   * that wants the proprietary `audience` parameter instead must map it itself.
   *
   * https://www.rfc-editor.org/rfc/rfc8707
   */
  resource?: TokenRequest["resource"];
  scope?: Array<string>;
};

type CacheItem = {
  accessToken: string;
  issuer: string;
  resource: string | null;
  scope: Array<string>;
  tokenType: string;
  tokenUri: string;
  ttl: number;
};

export type ConduitClientCredentialsCache = Array<CacheItem>;

export type ConduitClientCredentialsMiddlewareFactory = (
  options?: ConduitClientCredentialsOptions,
  logger?: ILogger,
) => Promise<ConduitMiddleware>;

const DEFAULT = "_@DEFAULT" as const;
const OIDCONF = "/.well-known/openid-configuration" as const;

const inFlightTokenRequests = new Map<string, Promise<ConduitMiddleware>>();

const replaceInCache = (cache: ConduitClientCredentialsCache, item: CacheItem): void => {
  const now = Date.now();

  for (let i = cache.length - 1; i >= 0; i--) {
    const entry = cache[i];
    if (
      entry.resource === item.resource &&
      entry.issuer === item.issuer &&
      entry.ttl <= now
    ) {
      cache.splice(i, 1);
    }
  }

  cache.push(item);
};

export const conduitClientCredentialsMiddlewareFactory = (
  config: ConduitClientCredentialsConfig,
  cache: ConduitClientCredentialsCache = [],
): ConduitClientCredentialsMiddlewareFactory => {
  const {
    authLocation = "body",
    clientId,
    clientSecret,
    clockTolerance = 10,
    contentType = "application/json",
    dpopSigner,
    grantType = "client_credentials",
    issuer,
  } = config;

  const bindAccessToken = (accessToken: string, tokenType?: string): ConduitMiddleware =>
    dpopSigner
      ? createConduitDpopAuthMiddleware(dpopSigner)(accessToken)
      : conduitBearerAuthMiddleware(accessToken, tokenType);

  return async function conduitClientCredentialsMiddleware(
    options?: ConduitClientCredentialsOptions,
    logger?: ILogger,
  ): Promise<ConduitMiddleware> {
    const { resource = DEFAULT, scope = [] } = options ?? {};

    const cachedToken = cache.filter(
      (item) => item.resource === resource && item.issuer === issuer,
    );

    const existing = cachedToken.find((item) =>
      scope.every((s) => item.scope.includes(s)),
    );

    if (existing && existing.ttl > Date.now()) {
      return bindAccessToken(existing.accessToken, existing.tokenType);
    }

    const inFlightKey = `${resource}:${issuer}`;
    const inFlight = inFlightTokenRequests.get(inFlightKey);

    if (inFlight) {
      return inFlight;
    }

    const tokenPromise = (async (): Promise<ConduitMiddleware> => {
      const client = new Conduit({
        baseURL: issuer,
        logger,
        middleware: [
          conduitChangeRequestBodyMiddleware("snake"),
          conduitChangeResponseDataMiddleware("camel"),
        ],
      });

      const cachedIssuer = cache.find((item) => item.issuer === issuer);

      let tokenUri = cachedIssuer?.tokenUri ?? config.tokenUri ?? null;

      if (!tokenUri) {
        // Responses are camelised by `conduitChangeResponseDataMiddleware("camel")`,
        // so the document arrives in the shape of `OpenIdConfiguration`. The spec marks
        // `token_endpoint` REQUIRED, but a real issuer can still omit it — hence the
        // guard below.
        const {
          data: { tokenEndpoint },
        } = await client.get<OpenIdConfiguration>(OIDCONF);

        tokenUri = tokenEndpoint;

        if (!tokenUri) {
          throw new BadGatewayError("Token endpoint not found in OpenID configuration", {
            code: "token_endpoint_not_found",
            title: "Token Endpoint Not Found",
            details: `The OpenID configuration fetched from issuer "${issuer}" did not include a token_endpoint, so client credentials cannot be exchanged; verify the issuer's discovery document or set tokenUri explicitly.`,
            type: "urn:lindorm:conduit:error:token_endpoint_not_found",
            debug: { issuer },
          });
        }
      }

      const requestOptions: ConduitRequestOptions = {};

      const requestContent: Dict<string> = {
        ...(authLocation === "body" ? { clientId, clientSecret } : {}),
        grantType,
        ...(resource && resource !== DEFAULT ? { resource } : {}),
        ...(scope.length > 0 ? { scope: scope.join(" ") } : {}),
      };

      if (contentType === "application/json") {
        requestOptions.body = requestContent;
      } else if (contentType === "application/x-www-form-urlencoded") {
        const form = new FormData();

        for (const [key, value] of Object.entries(requestContent)) {
          form.append(key, value);
        }

        requestOptions.form = form;
      } else {
        throw new InternalServerError("Unsupported content type", {
          code: "unsupported_content_type",
          title: "Unsupported Content Type",
          details: `The configured token request content type "${contentType as string}" is not supported; use "application/json" or "application/x-www-form-urlencoded".`,
          type: "urn:lindorm:conduit:error:unsupported_content_type",
          debug: { contentType },
        });
      }

      // RFC 9449 §5: bind the access token to the client's DPoP key by
      // presenting a proof on the token endpoint request. The proof
      // carries htm/htu for the token endpoint itself and no `ath`
      // (there's no access token yet).
      const dpopMiddleware: ConduitMiddleware | null = dpopSigner
        ? async function conduitDpopTokenEndpointProof(ctx, next) {
            const proof = await buildDpopProof({
              signer: dpopSigner,
              httpMethod: ctx.req.config.method,
              httpUri: ctx.req.url,
            });
            ctx.req.headers = { ...ctx.req.headers, DPoP: proof };
            await next();
          }
        : null;

      const { data } = await client.post<TokenResponse>(tokenUri, {
        ...requestOptions,
        middleware: [
          ...(authLocation === "header"
            ? [conduitBasicAuthMiddleware(clientId, clientSecret)]
            : []),
          ...(dpopMiddleware ? [dpopMiddleware] : []),
        ],
      });

      const receivedScope = isArray<string>(data.scope)
        ? data.scope
        : isString(data.scope)
          ? data.scope.split(" ")
          : scope;

      const ttl = data.expiresOn
        ? data.expiresOn * 1000
        : data.expiresIn
          ? Date.now() + data.expiresIn * 1000
          : config.defaultExpiration
            ? Date.now() + config.defaultExpiration * 1000
            : undefined;

      if (!data.accessToken) {
        throw new BadGatewayError("Token not provided", {
          code: "token_not_provided",
          title: "Token Not Provided",
          details:
            "The token endpoint responded without an access_token, so no bearer token could be cached; check the client credentials and the authorization server's response.",
          type: "urn:lindorm:conduit:error:token_not_provided",
          debug: { response: data },
        });
      }

      if (!ttl) {
        throw new BadGatewayError("Token expiration not provided", {
          code: "token_expiration_not_provided",
          title: "Token Expiration Not Provided",
          details:
            "The token endpoint returned neither expiresOn nor expiresIn and no defaultExpiration is configured, so the token's lifetime is unknown; set defaultExpiration or fix the authorization server response.",
          type: "urn:lindorm:conduit:error:token_expiration_not_provided",
          debug: { response: data },
        });
      }

      replaceInCache(cache, {
        accessToken: data.accessToken,
        issuer,
        resource,
        scope: receivedScope,
        tokenType: data.tokenType ?? "Bearer",
        tokenUri,
        ttl: ttl - clockTolerance * 1000,
      });

      return bindAccessToken(data.accessToken, data.tokenType);
    })().finally(() => {
      inFlightTokenRequests.delete(inFlightKey);
    });

    inFlightTokenRequests.set(inFlightKey, tokenPromise);

    return tokenPromise;
  };
};
