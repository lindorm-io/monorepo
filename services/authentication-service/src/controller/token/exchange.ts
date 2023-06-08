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
    signature: token,
  });

  const { token: signed, expiresIn } = jwt.sign<AuthenticationConfirmationTokenClaims>({
    id: authenticationConfirmationToken.id,
    audiences: [authenticationConfirmationToken.clientId, configuration.oauth.client_id].sort(),
    authContextClass: `loa_${authenticationConfirmationToken.levelOfAssurance}`,
    authMethodsReference: authenticationConfirmationToken.methods,
    authTime: getUnixTime(authenticationConfirmationToken.created),
    claims: {
      confirmedIdentifiers: authenticationConfirmationToken.confirmedIdentifiers,
      country: authenticationConfirmationToken.country,
    },
    expiry: authenticationConfirmationToken.expires,
    issuedAt: authenticationConfirmationToken.created,
    levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
    nonce: authenticationConfirmationToken.nonce,
    notBefore: authenticationConfirmationToken.created,
    scopes: ["authentication"],
    session: authenticationConfirmationToken.sessionId,
    subject: authenticationConfirmationToken.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: AuthenticationTokenType.AUTHENTICATION_CONFIRMATION,
  });

  return { body: { expiresIn, token: signed } };
};
