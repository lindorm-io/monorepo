import Joi from "joi";
import { AuthenticationMethod } from "../../common";
import { AuthenticationSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_PKCE_METHOD } from "../../constant";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { PKCEMethod } from "@lindorm-io/core";
import { ServerKoaController } from "../../types";
import {
  initialiseElevateAuthenticationSession,
  initialiseOauthAuthenticationSession,
  initialiseStandardAuthenticationSession,
} from "../../handler";

type RequestData = {
  clientId?: string;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  country?: string;
  identityId?: string;
  levelOfAssurance?: LevelOfAssurance;
  loginHint?: Array<string>;
  methods?: Array<AuthenticationMethod>;
  nonce?: string;
  elevationSessionId?: string;
  oauthSessionId?: string;
};

type ResponseBody = {
  id: string;
};

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
      elevationSessionId,
      identityId,
      levelOfAssurance,
      loginHint,
      methods,
      nonce,
      oauthSessionId,
    },
  } = ctx;

  let authenticationSession: AuthenticationSession;

  if (elevationSessionId) {
    authenticationSession = await initialiseElevateAuthenticationSession(ctx, {
      codeChallenge,
      codeChallengeMethod,
      elevationSessionId,
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

  return {
    body: { id: authenticationSession.id },
  };
};
