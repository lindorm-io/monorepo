import { ChangeCase } from "@lindorm/case";
import { isArray, isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Dict, OpenIdConfigurationResponse, OpenIdTokenResponse } from "@lindorm/types";
import { Conduit } from "../classes";
import { ConduitUsing } from "../enums";
import { ConduitError } from "../errors";
import { ConduitMiddleware, RequestOptions } from "../types";
import { conduitBasicAuthMiddleware } from "./conduit-basic-auth-middleware";
import { conduitBearerAuthMiddleware } from "./conduit-bearer-auth-middleware";
import { conduitChangeRequestBodyMiddleware } from "./conduit-change-request-body-middleware";
import { conduitChangeResponseDataMiddleware } from "./conduit-change-response-data-middleware";

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
  grantType?: "client_credentials";
  issuer: string;
  tokenUri?: string;
  using?: ConduitUsing;
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

const replaceInCache = (cache: ConduitClientCredentialsCache, item: CacheItem): void => {
  const now = Date.now();

  for (const [index, entry] of cache.entries()) {
    if (
      entry.audience === item.audience &&
      entry.issuer === item.issuer &&
      entry.ttl <= now
    ) {
      cache.splice(index, 1);
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
    grantType = "client_credentials",
    issuer,
    using,
  } = config;

  return async function conduitClientCredentialsMiddleware(
    options?: Options,
    logger?: ILogger,
  ): Promise<ConduitMiddleware> {
    const { audience = DEFAULT, scope = [] } = options ?? {};

    const cachedToken = cache.filter(
      (item) => item.audience === audience && item.issuer === issuer,
    );

    const existing = cachedToken.find((item) =>
      scope.every((scope) => item.scope.includes(scope)),
    );

    if (existing && existing.ttl > Date.now()) {
      return conduitBearerAuthMiddleware(existing.accessToken, existing.tokenType);
    }

    const client = new Conduit({
      baseUrl: issuer,
      logger,
      middleware: [
        conduitChangeRequestBodyMiddleware(ChangeCase.Snake),
        conduitChangeResponseDataMiddleware(ChangeCase.Camel),
      ],
      using,
    });

    const cachedIssuer = cache.find((item) => item.issuer === issuer);

    let tokenUri = cachedIssuer?.tokenUri ?? config.tokenUri ?? null;

    if (!tokenUri) {
      const {
        data: { tokenEndpoint },
      } = await client.get<OpenIdConfigurationResponse>(OIDCONF);

      tokenUri = tokenEndpoint;
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
        form.append(key, value as string);
      }

      requestOptions.form = form;
    } else {
      throw new ConduitError("Unsupported content type", {
        debug: { contentType },
      });
    }

    const { data } = await client.post<OpenIdTokenResponse>(tokenUri, {
      ...requestOptions,
      middleware: [
        ...(authLocation === "header"
          ? [conduitBasicAuthMiddleware(clientId, clientSecret)]
          : []),
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
          ? config.defaultExpiration * 1000
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

    return conduitBearerAuthMiddleware(data.accessToken, data.tokenType);
  };
};
