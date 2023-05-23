import {
  InitialiseAuthenticationRequestBody,
  InitialiseAuthenticationResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_PKCE_METHOD } from "../../constant";
import { AuthenticationSession } from "../../entity";
import {
  initialiseElevateAuthenticationSession,
  initialiseOauthAuthenticationSession,
  initialiseStandardAuthenticationSession,
} from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = InitialiseAuthenticationRequestBody;

type ResponseBody = InitialiseAuthenticationResponse;

export const initialiseAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    codeChallenge: Joi.string().required(),
    codeChallengeMethod: JOI_PKCE_METHOD.required(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();

export const initialiseAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: {
      clientId,
      codeChallenge,
      codeChallengeMethod,
      country,
      elevationRequestId,
      identityId,
      levelOfAssurance,
      loginHint,
      methods,
      nonce,
      oauthSessionId,
    },
  } = ctx;

  let authenticationSession: AuthenticationSession;

  if (elevationRequestId) {
    authenticationSession = await initialiseElevateAuthenticationSession(ctx, {
      codeChallenge,
      codeChallengeMethod,
      elevationRequestId,
    });
  } else if (oauthSessionId) {
    authenticationSession = await initialiseOauthAuthenticationSession(ctx, {
      codeChallenge,
      codeChallengeMethod,
      oauthSessionId,
    });
  } else {
    authenticationSession = await initialiseStandardAuthenticationSession(ctx, {
      clientId,
      codeChallenge,
      codeChallengeMethod,
      country,
      identityId,
      levelOfAssurance,
      loginHint,
      methods,
      nonce,
    });
  }

  return { body: { id: authenticationSession.id } };
};
