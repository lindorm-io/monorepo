import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";

export const assertAuthorizeRedirectUri = (
  authorizationSession: AuthorizationSession,
  client: Client,
): void => {
  if (client.redirectUri !== authorizationSession.redirectUri) {
    throw new ClientError("Invalid Redirect URI", {
      code: "invalid_request",
      description: "Invalid redirect uri",
      debug: {
        expect: client.redirectUri,
        actual: authorizationSession.redirectUri,
      },
    });
  }
};
