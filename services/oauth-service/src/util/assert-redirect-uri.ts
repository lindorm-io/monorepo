import { Client } from "../entity";
import { ClientError } from "@lindorm-io/errors";

export const assertRedirectUri = (redirectUri: string, client: Client): void => {
  if (client.redirectUris.includes(redirectUri)) return;

  throw new ClientError("Invalid Redirect URI", {
    code: "invalid_request",
    description: "Invalid redirect uri",
    debug: {
      expect: client.redirectUris,
      actual: redirectUri,
    },
  });
};
