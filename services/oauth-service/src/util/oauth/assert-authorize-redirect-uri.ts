import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { includes } from "lodash";

export const assertAuthorizeRedirectUri = (
  authorizationSession: AuthorizationSession,
  client: Client,
): void => {
  if (includes(client.redirectUris, authorizationSession.redirectUri)) return;

  throw new ClientError("Invalid Redirect URI", {
    code: "invalid_request",
    description: "Invalid redirect uri",
    debug: {
      expect: client.redirectUris,
      actual: authorizationSession.redirectUri,
    },
  });
};
