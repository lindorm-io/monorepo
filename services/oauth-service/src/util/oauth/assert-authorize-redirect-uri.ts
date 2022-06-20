import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";

export const assertAuthorizeRedirectUri = (
  authorizationSession: AuthorizationSession,
  client: Client,
): void => {
  if (client.redirectUris.includes(authorizationSession.redirectUri)) return;

  throw new ClientError("Invalid Redirect URI", {
    code: "invalid_request",
    description: "Invalid redirect uri",
    debug: {
      expect: client.redirectUris,
      actual: authorizationSession.redirectUri,
    },
  });
};
