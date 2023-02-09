import { Axios } from "../class";
import { MetadataHeader } from "../enum";
import { Middleware, OAuthTokenResponseData } from "../types";
import { axiosBasicAuthMiddleware } from "./axios-basic-auth-middleware";
import { axiosTransformBodyCaseMiddleware } from "./axios-transform-body-case-middleware";
import { getUnixTime } from "../util";

export type AxiosClientCredentialsMiddlewareOptions = {
  clientEnvironment?: string;
  clientId: string;
  clientSecret: string;
  clientVersion?: string;
  grantType?: string;
  path?: string;
  timeoutAdjustment?: number;
  useBasicAuth?: boolean;
};

const isString = (value?: any): value is string => value && typeof value === "string";

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
        scopes.filter((s) => !bearerScopes.includes(s)).length
      ) {
        const {
          data: { accessToken, expiresIn, scope },
        } = await oauthClient.post<OAuthTokenResponseData>(path, {
          body: {
            ...(!useBasicAuth ? { clientId, clientSecret } : {}),
            grantType,
            scope: [...new Set([bearerScopes, scopes].flat())].join(" "),
          },
          headers,
          middleware,
        });

        const array = isString(scope) ? scope.split(" ") : Array.isArray(scope) ? scope : [];

        bearerScopes = [...new Set([bearerScopes, array].flat())];
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
