import { Axios } from "../class";
import { MetadataHeader } from "../enum";
import { Middleware, OAuthTokenResponseData } from "../types";
import { axiosBasicAuthMiddleware } from "./axios-basic-auth-middleware";
import { axiosTransformBodyCaseMiddleware } from "./axios-transform-body-case-middleware";
import { difference, flatten, isArray, isString, uniq } from "lodash";
import { getUnixTime } from "../util";

export type AxiosClientCredentialsMiddlewareOptions = {
  clientEnvironment?: string;
  clientId?: string;
  clientSecret?: string;
  clientVersion?: string;
  grantType?: string;
  path?: string;
  timeoutAdjustment?: number;
  useBasicAuth?: boolean;
};

export const axiosClientCredentialsMiddleware = (
  options: AxiosClientCredentialsMiddlewareOptions,
) => {
  const {
    clientEnvironment,
    clientId,
    clientSecret,
    clientVersion,
    grantType = "client_credentials",
    path = "/oauth2/token",
    timeoutAdjustment = 5,
    useBasicAuth = true,
  } = options;

  const headers = {
    ...(clientId ? { [MetadataHeader.CLIENT_ID]: clientId } : {}),
    ...(clientEnvironment ? { [MetadataHeader.CLIENT_ENVIRONMENT]: clientEnvironment } : {}),
    ...(clientVersion ? { [MetadataHeader.CLIENT_VERSION]: clientVersion } : {}),
  };

  const middleware = [
    ...(useBasicAuth
      ? [axiosBasicAuthMiddleware({ username: clientId, password: clientSecret })]
      : []),
    axiosTransformBodyCaseMiddleware("snake", "camel"),
  ];

  let bearerScopes: Array<string> = [];
  let bearerTimeout = 0;
  let bearerToken: string | null = null;

  return (oauthClient: Axios, scopes: Array<string> = [], force = false): Middleware =>
    async (ctx, next) => {
      const now = getUnixTime();

      if (
        force ||
        !bearerToken ||
        now >= bearerTimeout ||
        difference(scopes, bearerScopes).length
      ) {
        const {
          data: { accessToken, expiresIn, scope },
        } = await oauthClient.post<OAuthTokenResponseData>(path, {
          body: {
            ...(!useBasicAuth ? { clientId, clientSecret } : {}),
            grantType,
            scope: uniq(flatten([bearerScopes, scopes])).join(" "),
          },
          headers,
          middleware,
        });

        const array = isString(scope) ? scope.split(" ") : isArray(scope) ? scope : [];

        bearerScopes = uniq(flatten([bearerScopes, array]));
        bearerTimeout = now + expiresIn - timeoutAdjustment;
        bearerToken = accessToken;
      }

      ctx.req.headers = {
        ...ctx.req.headers,
        Authorization: `Bearer ${bearerToken}`,
        ...headers,
      };

      await next();
    };
};
