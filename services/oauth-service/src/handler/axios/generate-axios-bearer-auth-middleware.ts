import { ServerKoaContext } from "../../types";
import { SubjectHint, TokenType } from "../../common";
import { axiosBearerAuthMiddleware, Middleware as AxiosMiddleware } from "@lindorm-io/axios";
import { configuration } from "../../server/configuration";
import { flatten, uniq } from "lodash";

export const generateAxiosBearerAuthMiddleware = (
  ctx: ServerKoaContext,
  permissions: Array<string>,
  audiences?: Array<string>,
  scopes?: Array<string>,
): AxiosMiddleware => {
  const { jwt } = ctx;

  const { token } = jwt.sign({
    audiences: uniq(flatten([configuration.oauth.client_id, audiences])).sort(),
    expiry: configuration.defaults.expiry.client_credentials,
    permissions,
    scopes: scopes || [],
    subject: configuration.oauth.client_id,
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
  });

  return axiosBearerAuthMiddleware(token);
};
