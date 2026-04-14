import { buildDpopProof } from "#internal/build-dpop-proof";
import { isArray, isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import {
  Dict,
  DpopSigner,
  OpenIdConfigurationResponse,
  OpenIdTokenResponse,
} from "@lindorm/types";
import { Conduit } from "../classes";
import { ConduitError } from "../errors";
import { ConduitMiddleware, RequestOptions } from "../types";
import { conduitBasicAuthMiddleware } from "./conduit-basic-auth-middleware";
import { conduitBearerAuthMiddleware } from "./conduit-bearer-auth-middleware";
import { conduitChangeRequestBodyMiddleware } from "./conduit-change-request-body-middleware";
import { conduitChangeResponseDataMiddleware } from "./conduit-change-response-data-middleware";
import { createConduitDpopAuthMiddleware } from "./conduit-dpop-auth-middleware";

export type ClientCredentialsAuthLocation = "body" | "header";

export type ClientCredentialsContentType =
  | "application/json"
  | "application/x-www-form-urlencoded";

type Config = {
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

type Options = {
  audience?: string;
  scope?: Array<string>;
};

type CacheItem = {
  accessToken: string;
  audience: string | null;
  issuer: string;
  scope: Array<string>;
  tokenType: string;
  tokenUri: string;
  ttl: number;
};

export type ConduitClientCredentialsCache = Array<CacheItem>;

export type ConduitClientCredentialsMiddlewareFactory = (
  options?: Options,
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
      entry.audience === item.audience &&
      entry.issuer === item.issuer &&
      entry.ttl <= now
    ) {
      cache.splice(i, 1);
    }
  }

  cache.push(item);
};

export const conduitClientCredentialsMiddlewareFactory = (
  config: Config,
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
    options?: Options,
    logger?: ILogger,
  ): Promise<ConduitMiddleware> {
    const { audience = DEFAULT, scope = [] } = options ?? {};

    const cachedToken = cache.filter(
      (item) => item.audience === audience && item.issuer === issuer,
    );

    const existing = cachedToken.find((item) =>
      scope.every((s) => item.scope.includes(s)),
    );

    if (existing && existing.ttl > Date.now()) {
      return bindAccessToken(existing.accessToken, existing.tokenType);
    }

    const inFlightKey = `${audience}:${issuer}`;
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
        const {
          data: { tokenEndpoint },
        } = await client.get<OpenIdConfigurationResponse>(OIDCONF);

        tokenUri = tokenEndpoint;

        if (!tokenUri) {
          throw new ConduitError("Token endpoint not found in OpenID configuration", {
            debug: { issuer },
          });
        }
      }

      const requestOptions: RequestOptions = {};

      const requestContent: Dict<string> = {
        ...(audience && audience !== DEFAULT ? { audience } : {}),
        ...(authLocation === "body" ? { clientId, clientSecret } : {}),
        grantType,
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
        throw new ConduitError("Unsupported content type", {
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

      const { data } = await client.post<OpenIdTokenResponse>(tokenUri, {
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
        throw new ConduitError("Token not provided", { debug: data });
      }

      if (!ttl) {
        throw new ConduitError("Token expiration not provided", { debug: data });
      }

      replaceInCache(cache, {
        accessToken: data.accessToken,
        audience,
        issuer,
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
