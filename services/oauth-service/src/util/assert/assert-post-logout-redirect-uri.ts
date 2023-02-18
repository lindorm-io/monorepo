import { Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";

export const assertPostLogoutRedirectUri = (
  client: Client,
  postLogoutRedirectUri: string,
): void => {
  if (client.postLogoutUris.includes(postLogoutRedirectUri)) return;

  throw new ClientError("Invalid Redirect URI", {
    code: "invalid_request",
    description: "Invalid redirect uri",
    debug: {
      expect: client.postLogoutUris,
      actual: postLogoutRedirectUri,
    },
  });
};
