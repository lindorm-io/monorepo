import { Axios } from "../../class";
import { AxiosMiddleware, AxiosRequest, OAuthTokenResponseData } from "../../types";
import { difference, flatten, uniq } from "lodash";
import { getUnixTime } from "date-fns";
import { MetadataHeader } from "../../enum";

interface MiddlewareOptions {
  clientEnvironment: string;
  clientId: string;
  clientSecret: string;
  clientVersion: string;
  grantType?: string;
  path?: string;
  timeoutAdjustment?: number;
}

export const axiosClientCredentialsMiddleware = (middlewareOptions: MiddlewareOptions) => {
  const {
    clientEnvironment,
    clientId,
    clientSecret,
    clientVersion,
    grantType = "client_credentials",
    path = "/oauth2/token",
    timeoutAdjustment = 5,
  } = middlewareOptions;

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
          data: {
            clientId,
            clientSecret,
            grantType,
            scope: uniq(flatten([bearerScopes, scopes])).join(" "),
          },
          headers: {
            [MetadataHeader.CLIENT_ID]: clientId,
            [MetadataHeader.CLIENT_ENVIRONMENT]: clientEnvironment,
            [MetadataHeader.CLIENT_VERSION]: clientVersion,
          },
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
