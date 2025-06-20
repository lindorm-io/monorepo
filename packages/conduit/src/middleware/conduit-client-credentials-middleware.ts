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

type Config = {
  clientId: string;
  clientSecret: string;
  clockTolerance?: number;
  contentType?: "application/json" | "application/x-www-form-urlencoded";
  defaultExpiration?: number;
  openIdBaseUrl: string;
  openIdConfigurationPath?: string;
  openIdTokenPath?: string;
  using?: ConduitUsing;
};

type Options = {
  audience?: string;
  scope?: Array<string>;
};

type CacheItem = {
  accessToken: string;
  audience: string | null;
  scope: Array<string>;
  tokenType: string;
  ttl: number;
};

type Cache = Array<CacheItem>;

export type ConduitClientCredentialsMiddlewareFactory = (
  options?: Options,
  logger?: ILogger,
) => Promise<ConduitMiddleware>;

const DEFAULT = "_@DEFAULT" as const;

export const conduitClientCredentialsMiddleware = (
  config: Config,
): ConduitClientCredentialsMiddlewareFactory => {
  const {
    clockTolerance = 10,
    openIdConfigurationPath = "/.well-known/openid-configuration",
  } = config;

  const baseUrl = config.openIdBaseUrl.endsWith("/")
    ? config.openIdBaseUrl.slice(0, -1)
    : config.openIdBaseUrl;

  let cache: Cache = [];
  let tokenUrl: string | null = config.openIdTokenPath ?? null;

  return async function conduitClientCredentialsMiddleware(
    options?: Options,
    logger?: ILogger,
  ): Promise<ConduitMiddleware> {
    const { audience = DEFAULT, scope = [] } = options ?? {};

    cache = cache.filter((item) => item.ttl > Date.now());

    const filtered = cache.filter((item) => item.audience === audience);
    const existing = filtered.find((item) =>
      scope.every((scope) => item.scope.includes(scope)),
    );

    if (existing && existing.accessToken && existing.tokenType) {
      return conduitBearerAuthMiddleware(existing.accessToken, existing.tokenType);
    }

    const client = new Conduit({
      baseUrl,
      logger,
      middleware: [
        conduitChangeRequestBodyMiddleware(ChangeCase.Snake),
        conduitChangeResponseDataMiddleware(ChangeCase.Camel),
      ],
      using: config.using,
    });

    if (!tokenUrl) {
      const {
        data: { tokenEndpoint },
      } = await client.get<OpenIdConfigurationResponse>(openIdConfigurationPath);

      tokenUrl = tokenEndpoint.replace(baseUrl, "");
    }

    const contentType = config.contentType ?? "application/json";
    const requestOptions: RequestOptions = {};

    const requestContent: Dict<string> = {
      ...(audience !== DEFAULT ? { audience } : {}),
      grant_type: "client_credentials",
      ...(scope.length > 0 ? { scope: scope.join(" ") } : {}),
    };

    if (contentType === "application/json") {
      requestOptions.body = requestContent;
    }

    if (contentType === "application/x-www-form-urlencoded") {
      const form = new FormData();

      for (const [key, value] of Object.entries(requestContent)) {
        form.append(key, value as string);
      }

      requestOptions.form = form;
    }

    const { data } = await client.post<OpenIdTokenResponse>(tokenUrl, {
      ...requestOptions,
      middleware: [conduitBasicAuthMiddleware(config.clientId, config.clientSecret)],
    });

    const receivedScope = isArray(data.scope)
      ? data.scope
      : isString(data.scope)
        ? data.scope.split(" ")
        : [];

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

    cache.push({
      accessToken: data.accessToken,
      audience,
      scope: [...receivedScope, ...scope],
      tokenType: data.tokenType ?? "Bearer",
      ttl: ttl - clockTolerance * 1000,
    });

    return conduitBearerAuthMiddleware(data.accessToken, data.tokenType);
  };
};
