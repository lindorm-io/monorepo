import { ChangeCase } from "@lindorm/case";
import { isArray, isString } from "@lindorm/is";
import { Logger } from "@lindorm/logger";
import { Conduit } from "../../classes";
import { ConduitMiddleware, OAuthTokenResponse, OpenIdConfigurationResponse } from "../../types";
import { conduitBasicAuthMiddleware } from "./conduit-basic-auth-middleware";
import { conduitBearerAuthMiddleware } from "./conduit-bearer-auth-middleware";
import { conduitChangeRequestBodyMiddleware } from "./conduit-change-request-body-middleware";
import { conduitChangeResponseDataMiddleware } from "./conduit-change-response-data-middleware";
import { conduitHeaderMiddleware } from "./conduit-header-middleware";

type Config = {
  clientId: string;
  clientSecret: string;
  openIdConfigurationUrl: string;
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
  logger?: Logger,
) => Promise<ConduitMiddleware>;

const DEFAULT = "_@DEFAULT" as const;

export const createConduitClientCredentialsMiddleware = (
  config: Config,
): ConduitClientCredentialsMiddlewareFactory => {
  let cache: Cache = [];
  let tokenUrl: string | null;

  return async (options?: Options, logger?: Logger): Promise<ConduitMiddleware> => {
    const { audience = DEFAULT, scope = [] } = options ?? {};

    cache = cache.filter((item) => item.ttl > Date.now());

    const filtered = cache.filter((item) => item.audience === audience);
    const existing = filtered.find((item) => scope.every((scope) => item.scope.includes(scope)));

    if (existing && existing.accessToken && existing.tokenType) {
      return conduitBearerAuthMiddleware(existing.accessToken, existing.tokenType);
    }

    const client = new Conduit({
      logger,
      middleware: [
        conduitChangeRequestBodyMiddleware(ChangeCase.Snake),
        conduitChangeResponseDataMiddleware(ChangeCase.Camel),
      ],
    });

    if (!tokenUrl) {
      const {
        data: { tokenEndpoint },
      } = await client.get<OpenIdConfigurationResponse>(config.openIdConfigurationUrl);

      tokenUrl = tokenEndpoint;
    }

    const { data } = await client.post<OAuthTokenResponse>(tokenUrl, {
      body: {
        ...(audience !== DEFAULT ? { audience } : {}),
        grantType: "client_credentials",
        ...(scope.length > 0 ? { scope: scope.join(" ") } : {}),
      },
      middleware: [
        conduitBasicAuthMiddleware(config.clientId, config.clientSecret),
        conduitHeaderMiddleware("Content-Type", "application/json"),
      ],
    });

    cache.push({
      accessToken: data.accessToken,
      audience,
      scope: isArray(data.scope) ? data.scope : isString(data.scope) ? data.scope.split(" ") : [],
      tokenType: data.tokenType,
      ttl: Date.now() + data.expiresIn * 1000,
    });

    return conduitBearerAuthMiddleware(data.accessToken, data.tokenType);
  };
};
