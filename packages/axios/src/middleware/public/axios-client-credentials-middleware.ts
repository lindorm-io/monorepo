import { TransformMode } from "@lindorm-io/case";
import { OpenIdGrantType } from "@lindorm-io/common-enums";
import { OpenIdConfigurationResponse } from "@lindorm-io/common-types";
import { Logger } from "@lindorm-io/core-logger";
import { Axios } from "../../class";
import { Middleware, OAuthTokenResponseData } from "../../types";
import { getUnixTime } from "../../util/private";
import { axiosBasicAuthMiddleware } from "./axios-basic-auth-middleware";
import { axiosTransformRequestBodyMiddleware } from "./axios-transform-request-body-middleware";
import { axiosTransformRequestQueryMiddleware } from "./axios-transform-request-query-middleware";
import { axiosTransformResponseDataMiddleware } from "./axios-transform-response-data-middleware";

export type AxiosClientCredentialsMiddlewareOptions = {
  host: string;
  port?: number;
  clientId: string;
  clientSecret: string;
  configurationPath?: string;
  logger: Logger;
  timeoutAdjustment?: number;
  useBasicAuth?: boolean;
};

const isString = (value?: any): value is string => value && typeof value === "string";

export const axiosClientCredentialsMiddleware = (
  options: AxiosClientCredentialsMiddlewareOptions,
) => {
  const {
    host,
    port,
    clientId,
    clientSecret,
    configurationPath = "/.well-known/openid-configuration",
    logger,
    timeoutAdjustment = 5,
    useBasicAuth = true,
  } = options;

  const oauthClient = new Axios(
    {
      host,
      port,
      middleware: [
        axiosTransformRequestBodyMiddleware(TransformMode.SNAKE),
        axiosTransformRequestQueryMiddleware(TransformMode.SNAKE),
        axiosTransformResponseDataMiddleware(TransformMode.CAMEL),
        ...(useBasicAuth
          ? [axiosBasicAuthMiddleware({ username: clientId, password: clientSecret })]
          : []),
      ],
    },
    logger,
  );

  let bearerScopes: Array<string> = [];
  let bearerTimeout = 0;
  let bearerToken: string;
  let tokenEndpoint: string;

  return (scopes: Array<string> = [], force = false): Middleware =>
    async (ctx, next) => {
      const now = getUnixTime();

      if (!tokenEndpoint) {
        ({
          data: { tokenEndpoint },
        } = await oauthClient.get<OpenIdConfigurationResponse>(configurationPath));
      }

      if (
        force ||
        !bearerToken ||
        now >= bearerTimeout ||
        scopes.filter((s) => !bearerScopes.includes(s)).length
      ) {
        const {
          data: { accessToken, expiresIn, scope },
        } = await oauthClient.post<OAuthTokenResponseData>(tokenEndpoint, {
          body: {
            ...(!useBasicAuth ? { clientId, clientSecret } : {}),
            grantType: OpenIdGrantType.CLIENT_CREDENTIALS,
            scope: [...new Set([bearerScopes, scopes].flat())].join(" "),
          },
        });

        const array = isString(scope) ? scope.split(" ") : Array.isArray(scope) ? scope : [];

        bearerScopes = [...new Set([bearerScopes, array].flat())];
        bearerTimeout = now + expiresIn - timeoutAdjustment;
        bearerToken = accessToken;
      }

      ctx.req.headers = {
        ...ctx.req.headers,
        Authorization: `Bearer ${bearerToken}`,
      };

      await next();
    };
};
