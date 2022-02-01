import { Context } from "../../types";
import { SubjectHint } from "../../common";
import { TokenType } from "../../enum";
import { axiosBearerAuthMiddleware, AxiosMiddleware } from "@lindorm-io/axios";
import { configuration } from "../../configuration";

export const generateAxiosBearerAuthMiddleware = (
  ctx: Context,
  permissions: Array<string>,
  scopes: Array<string>,
): AxiosMiddleware => {
  const { jwt } = ctx;

  const { token } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.expiry.client_credentials,
    permissions,
    scopes,
    subject: configuration.oauth.client_id,
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
  });

  return axiosBearerAuthMiddleware(token);
};
