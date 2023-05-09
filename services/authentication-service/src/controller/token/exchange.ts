import {
  AuthenticationTokenType,
  SubjectHint,
  TokenExchangeRequestBody,
  TokenExchangeResponseBody,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { getUnixTime } from "date-fns";
import Joi from "joi";
import { AuthenticationConfirmationTokenClaims } from "../../common";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

type RequestData = TokenExchangeRequestBody;

type ResponseBody = TokenExchangeResponseBody;

export const tokenExchangeSchema = Joi.object<RequestData>()
  .keys({
    token: Joi.string().min(128).required(),
  })
  .required();

export const tokenExchangeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { token },
    jwt,
    redis: { authenticationConfirmationTokenCache },
  } = ctx;

  const authenticationConfirmationToken = await authenticationConfirmationTokenCache.find({
    token,
  });

  const { token: signed, expiresIn } = jwt.sign<AuthenticationConfirmationTokenClaims>({
    id: authenticationConfirmationToken.id,
    audiences: [authenticationConfirmationToken.clientId, configuration.oauth.client_id].sort(),
    authContextClass: `loa_${authenticationConfirmationToken.levelOfAssurance}`,
    authMethodsReference: authenticationConfirmationToken.methods,
    authTime: getUnixTime(authenticationConfirmationToken.created),
    claims: {
      country: authenticationConfirmationToken.country,
      maximumLoa: authenticationConfirmationToken.maximumLevelOfAssurance,
      remember: authenticationConfirmationToken.remember,
      sso: authenticationConfirmationToken.singleSignOn,
      verifiedIdentifiers: authenticationConfirmationToken.confirmedIdentifiers,
    },
    expiry: authenticationConfirmationToken.expires,
    levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
    nonce: authenticationConfirmationToken.nonce,
    scopes: ["authentication"],
    session: authenticationConfirmationToken.sessionId,
    subject: authenticationConfirmationToken.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: AuthenticationTokenType.AUTHENTICATION_CONFIRMATION,
  });

  return { body: { expiresIn, token: signed } };
};
