import { Axios } from "../../class";
import { AxiosMiddleware, AxiosRequest, OAuthTokenResponseData } from "../../types";
import { difference, flatten, uniq } from "lodash";
import { getUnixTime } from "date-fns";
import { MetadataHeader } from "../../enum";
import { axiosBasicAuthMiddleware } from "./axios-basic-auth-middleware";

export interface AxiosClientCredentialsMiddlewareConfig {
  clientEnvironment: string;
  clientId: string;
  clientSecret: string;
  clientVersion: string;
  grantType?: string;
  path?: string;
  timeoutAdjustment?: number;
  useBasicAuth?: boolean;
}

export const axiosClientCredentialsMiddleware = (
  config: AxiosClientCredentialsMiddlewareConfig,
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
  } = config;

  let bearerScopes: Array<string> = [];
  let bearerTimeout = 0;
  let bearerToken: string | null = null;

  return (oauthClient: Axios, scopes: Array<string> = [], force = false): AxiosMiddleware => ({
    request: async (request): Promise<AxiosRequest> => {
      const now = getUnixTime(new Date());

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
          headers: {
            [MetadataHeader.CLIENT_ID]: clientId,
            [MetadataHeader.CLIENT_ENVIRONMENT]: clientEnvironment,
            [MetadataHeader.CLIENT_VERSION]: clientVersion,
          },
          middleware: [
            ...(useBasicAuth
              ? [axiosBasicAuthMiddleware({ username: clientId, password: clientSecret })]
              : []),
          ],
        });

        bearerScopes = uniq(flatten([bearerScopes, scope]));
        bearerTimeout = now + expiresIn - timeoutAdjustment;
        bearerToken = accessToken;
      }

      return {
        ...request,
        headers: {
          ...(request.headers || {}),
          Authorization: `Bearer ${bearerToken}`,
          [MetadataHeader.CLIENT_ID]: clientId,
          [MetadataHeader.CLIENT_ENVIRONMENT]: clientEnvironment,
          [MetadataHeader.CLIENT_VERSION]: clientVersion,
        },
      };
    },
  });
};
